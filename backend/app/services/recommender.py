from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.models.schemas import (
    ExplanationFactor,
    ExplanationOut,
    RejectionReason,
    TasteDNAOut,
    UserPreferences,
)
from app.config import settings
from app.services import data_store


REJECTION_EFFECTS: dict[str, dict[str, float]] = {
    "too_expensive": {"budget_weight": 0.25, "rent_pull": -0.12},
    "too_small": {"surface_weight": 0.25, "surface_pull": 0.15},
    "too_dark": {"brightness_weight": 0.3, "brightness_pull": 0.2},
    "wrong_neighborhood": {"location_weight": 0.25},
    "disliked_style": {"style_weight": 0.3, "visual_pull": -0.15},
    "missing_amenities": {"amenity_weight": 0.25},
    "other": {"explore_boost": 0.05},
}


@dataclass
class UserModel:
    preferences: UserPreferences
    like_ids: list[str] = field(default_factory=list)
    reject_ids: list[str] = field(default_factory=list)
    favorites: list[str] = field(default_factory=list)
    reject_reasons: dict[str, str] = field(default_factory=dict)
    last_swipe_id: str | None = None
    last_swipe_action: str | None = None
    onboarding_complete: bool = False
    # Adaptive weights
    weights: dict[str, float] = field(
        default_factory=lambda: {
            "semantic": 0.28,
            "visual": 0.18,
            "budget": 0.18,
            "surface": 0.12,
            "location": 0.14,
            "style": 0.06,
            "amenity": 0.04,
            "explore": 0.08,
        }
    )
    # Soft preference pulls (relative shifts)
    rent_bias: float = 0.0
    surface_bias: float = 0.0
    brightness_bias: float = 0.0
    # Learned vectors
    text_pref: np.ndarray | None = None
    visual_pref: np.ndarray | None = None
    style_scores: dict[str, float] = field(default_factory=dict)
    neighborhood_scores: dict[str, float] = field(default_factory=dict)
    amenity_scores: dict[str, float] = field(default_factory=dict)
    dim_scores: dict[str, float] = field(
        default_factory=lambda: {
            "interior_design": 0.5,
            "natural_light": 0.5,
            "architecture": 0.5,
            "apartment_size": 0.5,
            "neighborhoods": 0.5,
            "layout": 0.5,
            "materials_finishes": 0.5,
            "amenities": 0.5,
        }
    )
    pending_seed_text: str = ""


class RecommendationEngine:
    def __init__(self) -> None:
        self.listings = data_store.load_listings()
        self.meta = data_store.load_meta()
        self.text_emb, self.visual_emb, self.ids = data_store.load_embeddings()
        self.id_to_idx = {lid: i for i, lid in enumerate(self.ids)}
        self.listing_by_id = {x["id"]: x for x in self.listings}
        self.users: dict[str, UserModel] = {}
        self._text_encoder = None

    def _encoder(self):
        if self._text_encoder is None:
            from sentence_transformers import SentenceTransformer

            self._text_encoder = SentenceTransformer(self.meta.get("text_model", settings.text_model))
        return self._text_encoder

    def _ensure_seed_pref(self, user: UserModel) -> None:
        """Lazily encode onboarding dream text once, outside the critical path."""
        if user.text_pref is not None or not user.pending_seed_text:
            return
        try:
            vec = self._encoder().encode([user.pending_seed_text], normalize_embeddings=True)[0]
            user.text_pref = np.asarray(vec, dtype=np.float32)
            user.pending_seed_text = ""
        except Exception:
            user.pending_seed_text = ""

    def get_or_create_user(self, user_id: str = "default") -> UserModel:
        if user_id not in self.users:
            self.users[user_id] = UserModel(preferences=UserPreferences())
        return self.users[user_id]

    def reset_user(self, user_id: str = "default") -> UserModel:
        self.users[user_id] = UserModel(preferences=UserPreferences())
        return self.users[user_id]

    def apply_onboarding(self, user_id: str, prefs: UserPreferences, demo: bool = False) -> UserModel:
        user = self.get_or_create_user(user_id)
        if demo:
            prefs = UserPreferences(
                name="Camille",
                max_rent=1600,
                min_surface=30,
                arrondissements=[11, 10, 3, 4, 18],
                apartment_types=["apartment", "studio"],
                furnished="any",
                amenities=["balcony", "hardwood_floors", "elevator"],
                lifestyle=["walkable", "cafes", "parks"],
                aesthetic=["bright", "haussmannian", "parquet"],
                dream_description=(
                    "Bright Haussmannian apartment with wooden floors, near lively cafés, under €1,600."
                ),
                language=prefs.language,
                occupation="Product designer",
                about="Looking for a calm, light-filled home in central-east Paris.",
            )
        user.preferences = prefs
        user.onboarding_complete = True
        # IMPORTANT: never load SentenceTransformer here — it blocks the API event
        # loop for tens of seconds. Seed ranking from structured prefs only.
        # Text embedding preference is built lazily on the first search/swipe path.
        user.pending_seed_text = " ".join(
            p
            for p in [
                prefs.dream_description,
                " ".join(prefs.aesthetic),
                " ".join(prefs.lifestyle),
                " ".join(prefs.amenities),
            ]
            if p
        ).strip()
        # Seed DNA dims from declared prefs
        if prefs.min_surface >= 40:
            user.dim_scores["apartment_size"] = 0.65
        if "bright" in prefs.aesthetic or "lumineux" in " ".join(prefs.aesthetic).lower():
            user.dim_scores["natural_light"] = 0.7
            user.brightness_bias = 0.1
        for style in prefs.aesthetic:
            user.style_scores[style] = user.style_scores.get(style, 0.5) + 0.2
        for a in prefs.arrondissements:
            user.neighborhood_scores[str(a)] = 0.7
        for am in prefs.amenities:
            user.amenity_scores[am] = 0.65
        return user

    def _hard_mask(self, user: UserModel) -> np.ndarray:
        prefs = user.preferences
        # Soft hard constraints: allow slight over-budget for exploration
        max_rent = prefs.max_rent * (1.08 + abs(user.rent_bias) * 0.05)
        min_surf = max(10, prefs.min_surface * (0.9 - user.surface_bias * 0.1))
        mask = np.ones(len(self.listings), dtype=bool)
        for i, listing in enumerate(self.listings):
            if listing["id"] in user.like_ids or listing["id"] in user.reject_ids:
                mask[i] = False
                continue
            if listing["rent_eur"] > max_rent * 1.15:
                mask[i] = False
                continue
            if listing["surface_m2"] < min_surf * 0.75:
                mask[i] = False
                continue
            if prefs.apartment_types and listing["property_type"] not in prefs.apartment_types:
                # Soft: don't hard exclude, just keep for now
                pass
            if prefs.furnished == "furnished" and not listing["furnished"]:
                pass
            if prefs.furnished == "unfurnished" and listing["furnished"]:
                pass
        return mask

    def _budget_score(self, listing: dict, user: UserModel) -> float:
        target = user.preferences.max_rent * (1 + user.rent_bias)
        rent = listing["rent_eur"]
        if rent <= target:
            return 1.0 - 0.15 * (target - rent) / max(target, 1)
        # Over budget penalty
        over = (rent - target) / max(target, 1)
        return max(0.0, 1.0 - over * 2.2)

    def _surface_score(self, listing: dict, user: UserModel) -> float:
        target = user.preferences.min_surface * (1 + user.surface_bias)
        surf = listing["surface_m2"]
        if surf >= target:
            return min(1.0, 0.75 + 0.25 * min(1.0, (surf - target) / max(target, 1)))
        gap = (target - surf) / max(target, 1)
        return max(0.0, 1.0 - gap * 1.8)

    def _location_score(self, listing: dict, user: UserModel) -> float:
        arr = listing["arrondissement"]
        preferred = set(user.preferences.arrondissements)
        learned = user.neighborhood_scores.get(str(arr), 0.5)
        if arr in preferred:
            base = 0.95
        elif preferred:
            # Distance in arrondissement number as crude proximity
            dist = min(abs(arr - p) for p in preferred)
            base = max(0.2, 0.85 - 0.1 * dist)
        else:
            base = 0.5
        return float(np.clip(0.6 * base + 0.4 * learned, 0, 1))

    def _style_score(self, listing: dict, user: UserModel) -> float:
        style = listing["style"]
        score = user.style_scores.get(style, 0.5)
        aesthetic = {a.lower() for a in user.preferences.aesthetic}
        if style in aesthetic or any(a in listing.get("tags", []) for a in aesthetic):
            score = max(score, 0.75)
        return float(np.clip(score, 0, 1))

    def _amenity_score(self, listing: dict, user: UserModel) -> float:
        wanted = set(user.preferences.amenities) | {
            k for k, v in user.amenity_scores.items() if v >= 0.6
        }
        if not wanted:
            return 0.55
        have = set(listing.get("amenities", []))
        if not wanted:
            return 0.55
        return len(wanted & have) / max(len(wanted), 1)

    def _brightness_score(self, listing: dict, user: UserModel) -> float:
        b = listing.get("brightness", 0.5)
        target = 0.55 + user.brightness_bias
        return float(np.clip(1.0 - abs(b - target) * 1.4, 0, 1))

    def _semantic_score(self, idx: int, user: UserModel) -> float:
        if user.text_pref is None:
            return 0.5
        sim = float(np.dot(user.text_pref, self.text_emb[idx]))
        return float(np.clip((sim + 1) / 2, 0, 1))

    def _visual_score(self, idx: int, user: UserModel) -> float:
        if user.visual_pref is None:
            # Use brightness affinity as fallback
            return self._brightness_score(self.listings[idx], user)
        pref = user.visual_pref / (np.linalg.norm(user.visual_pref) + 1e-8)
        vec = self.visual_emb[idx] / (np.linalg.norm(self.visual_emb[idx]) + 1e-8)
        sim = float(np.dot(pref, vec))
        return float(np.clip((sim + 1) / 2, 0, 1))

    def score_listing(self, listing_id: str, user: UserModel) -> tuple[float, dict[str, float]]:
        idx = self.id_to_idx[listing_id]
        listing = self.listings[idx]
        parts = {
            "semantic": self._semantic_score(idx, user),
            "visual": self._visual_score(idx, user),
            "budget": self._budget_score(listing, user),
            "surface": self._surface_score(listing, user),
            "location": self._location_score(listing, user),
            "style": self._style_score(listing, user),
            "amenity": self._amenity_score(listing, user),
            "brightness": self._brightness_score(listing, user),
        }
        w = user.weights
        # Fold brightness into visual channel
        visual_combined = 0.55 * parts["visual"] + 0.45 * parts["brightness"]
        explore = float(np.random.RandomState(hash(listing_id) % (2**31)).rand())
        total = (
            w["semantic"] * parts["semantic"]
            + w["visual"] * visual_combined
            + w["budget"] * parts["budget"]
            + w["surface"] * parts["surface"]
            + w["location"] * parts["location"]
            + w["style"] * parts["style"]
            + w["amenity"] * parts["amenity"]
            + w["explore"] * explore * 0.35
        )
        # Soft demote high-risk synthetic scam tests so they remain discoverable
        # via map/search but do not dominate the swipe feed on price alone.
        if listing.get("is_scam_test"):
            total *= 0.55 if listing.get("scam_label") == "high" else 0.72
        # Normalize roughly to 0-100 match
        match = float(np.clip(total / (sum(w.values()) - w["explore"] + w["explore"] * 0.35) * 100, 1, 99))
        parts["visual_combined"] = visual_combined
        parts["explore"] = explore
        parts["match"] = match
        return match, parts

    def rank(self, user_id: str = "default", limit: int = 50, include_seen: bool = False) -> list[dict]:
        user = self.get_or_create_user(user_id)
        mask = np.ones(len(self.listings), dtype=bool) if include_seen else self._hard_mask(user)
        scored = []
        for i, listing in enumerate(self.listings):
            if not mask[i]:
                continue
            match, parts = self.score_listing(listing["id"], user)
            item = {**listing, "match_score": round(match, 1), "_parts": parts}
            scored.append(item)
        scored.sort(key=lambda x: x["match_score"], reverse=True)
        return scored[:limit]

    def feed(self, user_id: str = "default", limit: int = 20) -> list[dict]:
        ranked = self.rank(user_id, limit=max(limit * 3, 60))
        normal = [x for x in ranked if not x.get("is_scam_test")]
        scams = [x for x in ranked if x.get("is_scam_test")]
        # Keep scam test cases available later in the deck for detector demos
        merged = normal[: max(limit - 2, 1)] + scams[:2] + normal[max(limit - 2, 1) :]
        cleaned = [{k: v for k, v in x.items() if not k.startswith("_")} for x in merged[:limit]]
        return cleaned

    def _update_vector(self, current: np.ndarray | None, target: np.ndarray, positive: bool, lr: float = 0.18):
        direction = 1.0 if positive else -1.0
        if current is None:
            return (direction * target).astype(np.float32)
        updated = (1 - lr) * current + lr * direction * target
        norm = np.linalg.norm(updated)
        if norm > 1e-8:
            updated = updated / norm
        return updated.astype(np.float32)

    def _bump(self, d: dict[str, float], key: str, delta: float):
        d[key] = float(np.clip(d.get(key, 0.5) + delta, 0.05, 0.98))

    def record_swipe(
        self,
        user_id: str,
        listing_id: str,
        action: str,
        reason: RejectionReason | None = None,
    ) -> UserModel:
        user = self.get_or_create_user(user_id)
        if listing_id not in self.id_to_idx:
            raise KeyError(listing_id)
        idx = self.id_to_idx[listing_id]
        listing = self.listings[idx]
        positive = action == "like"

        user.text_pref = self._update_vector(user.text_pref, self.text_emb[idx], positive)
        user.visual_pref = self._update_vector(user.visual_pref, self.visual_emb[idx], positive, lr=0.22)

        style = listing["style"]
        arr = str(listing["arrondissement"])
        self._bump(user.style_scores, style, 0.12 if positive else -0.14)
        self._bump(user.neighborhood_scores, arr, 0.1 if positive else -0.12)
        for am in listing.get("amenities", [])[:8]:
            self._bump(user.amenity_scores, am, 0.08 if positive else -0.05)

        # DNA dimensions
        b = listing.get("brightness", 0.5)
        if positive:
            self._bump(user.dim_scores, "natural_light", (b - 0.5) * 0.25)
            self._bump(user.dim_scores, "interior_design", 0.08)
            self._bump(user.dim_scores, "architecture", 0.07 if style in {"haussmannian", "art_deco", "luxury"} else 0.04)
            self._bump(user.dim_scores, "apartment_size", 0.05 if listing["surface_m2"] >= user.preferences.min_surface else 0.02)
            self._bump(user.dim_scores, "neighborhoods", 0.06)
            self._bump(user.dim_scores, "layout", 0.05 if listing["rooms"] >= 2 else 0.02)
            self._bump(user.dim_scores, "materials_finishes", 0.06 if "hardwood_floors" in listing.get("amenities", []) else 0.03)
            self._bump(user.dim_scores, "amenities", 0.05)
            if listing_id not in user.like_ids:
                user.like_ids.append(listing_id)
            if listing_id not in user.favorites:
                user.favorites.append(listing_id)
        else:
            self._bump(user.dim_scores, "natural_light", -(b - 0.5) * 0.15)
            if listing_id not in user.reject_ids:
                user.reject_ids.append(listing_id)
            if reason:
                user.reject_reasons[listing_id] = reason
                self._apply_rejection_reason(user, listing, reason)

        user.last_swipe_id = listing_id
        user.last_swipe_action = action
        return user

    def _apply_rejection_reason(self, user: UserModel, listing: dict, reason: str) -> None:
        effect = REJECTION_EFFECTS.get(reason, {})
        for key, delta in effect.items():
            if key.endswith("_weight"):
                wkey = key.replace("_weight", "")
                # Map aliases
                alias = {"brightness": "visual"}.get(wkey, wkey)
                if alias in user.weights:
                    user.weights[alias] = float(np.clip(user.weights[alias] + delta, 0.02, 0.45))
                    # Renormalize soft
                    total = sum(user.weights.values())
                    for k in user.weights:
                        user.weights[k] /= total
            elif key == "rent_pull":
                user.rent_bias += delta
                # Also tighten max rent perception
                user.preferences.max_rent = int(user.preferences.max_rent * (1 + delta * 0.5))
            elif key == "surface_pull":
                user.surface_bias += delta
                user.preferences.min_surface = int(user.preferences.min_surface * (1 + delta))
            elif key == "brightness_pull":
                user.brightness_bias += delta
                self._bump(user.dim_scores, "natural_light", delta)
            elif key == "visual_pull":
                self._bump(user.style_scores, listing["style"], delta)
                self._bump(user.dim_scores, "interior_design", delta)
            elif key == "explore_boost":
                user.weights["explore"] = float(np.clip(user.weights["explore"] + delta, 0.02, 0.2))

        if reason == "wrong_neighborhood":
            self._bump(user.neighborhood_scores, str(listing["arrondissement"]), -0.25)
            if listing["arrondissement"] in user.preferences.arrondissements:
                user.preferences.arrondissements = [
                    a for a in user.preferences.arrondissements if a != listing["arrondissement"]
                ]
        if reason == "missing_amenities":
            for am in listing.get("amenities", [])[:3]:
                self._bump(user.amenity_scores, am, -0.05)
            self._bump(user.dim_scores, "amenities", 0.1)
        if reason == "too_dark":
            self._bump(user.dim_scores, "natural_light", 0.18)
        if reason == "too_small":
            self._bump(user.dim_scores, "apartment_size", 0.15)
        if reason == "too_expensive":
            self._bump(user.dim_scores, "apartment_size", -0.05)

    def undo(self, user_id: str = "default") -> UserModel:
        user = self.get_or_create_user(user_id)
        if not user.last_swipe_id:
            return user
        lid = user.last_swipe_id
        action = user.last_swipe_action
        if action == "like":
            user.like_ids = [x for x in user.like_ids if x != lid]
            user.favorites = [x for x in user.favorites if x != lid]
        elif action == "reject":
            user.reject_ids = [x for x in user.reject_ids if x != lid]
            user.reject_reasons.pop(lid, None)
        user.last_swipe_id = None
        user.last_swipe_action = None
        return user

    def explain(self, user_id: str, listing_id: str, lang: str = "en") -> ExplanationOut:
        user = self.get_or_create_user(user_id)
        match, parts = self.score_listing(listing_id, user)
        listing = self.listing_by_id[listing_id]
        labels = {
            "en": {
                "budget": ("Matches your budget", "Slightly above your budget"),
                "location": ("In a preferred neighborhood", "Outside your preferred areas"),
                "surface": ("Fits your size needs", "Smaller than your ideal surface"),
                "style": ("Matches your interior style", "Different from your preferred style"),
                "semantic": ("Similar to homes you like", "Less aligned with your taste profile"),
                "visual": ("Visual vibe matches your taste", "Look differs from apartments you liked"),
                "amenity": ("Has amenities you care about", "Missing some preferred amenities"),
                "brightness": ("Natural light matches your preference", "Less bright than you prefer"),
            },
            "fr": {
                "budget": ("Correspond à votre budget", "Légèrement au-dessus de votre budget"),
                "location": ("Dans un quartier préféré", "Hors de vos quartiers préférés"),
                "surface": ("Correspond à votre besoin de surface", "Plus petit que votre idéal"),
                "style": ("Correspond à votre style intérieur", "Style différent de vos préférences"),
                "semantic": ("Similaire aux logements que vous aimez", "Moins aligné avec votre profil"),
                "visual": ("Ambiance visuelle proche de vos goûts", "Look différent de vos likes"),
                "amenity": ("Avec des équipements importants pour vous", "Il manque des équipements"),
                "brightness": ("Luminosité adaptée", "Moins lumineux que souhaité"),
            },
        }[lang if lang in ("en", "fr") else "en"]

        factors: list[ExplanationFactor] = []
        for key in ["budget", "location", "surface", "style", "semantic", "visual", "amenity", "brightness"]:
            score = parts.get(key, parts.get("visual_combined", 0.5))
            positive = score >= 0.58
            label_pair = labels[key]
            factors.append(
                ExplanationFactor(
                    key=key,
                    label=label_pair[0] if positive else label_pair[1],
                    positive=positive,
                    weight=round(float(score), 3),
                    detail=f"{key}={score:.2f}",
                )
            )
        factors.sort(key=lambda f: (-int(f.positive), -f.weight))
        compromises = [f.label for f in factors if not f.positive][:3]
        top = [f.label for f in factors if f.positive][:3]
        if lang == "fr":
            summary = (
                f"Correspondance {match:.0f}%. Points forts : {'; '.join(top)}. "
                + (f"Compromis : {'; '.join(compromises)}." if compromises else "")
            )
        else:
            summary = (
                f"{match:.0f}% match. Strengths: {'; '.join(top)}. "
                + (f"Trade-offs: {'; '.join(compromises)}." if compromises else "")
            )
        return ExplanationOut(
            listing_id=listing_id,
            match_score=round(match, 1),
            summary=summary.strip(),
            factors=factors,
            compromises=compromises,
        )

    def taste_dna(self, user_id: str = "default", lang: str = "en") -> TasteDNAOut:
        user = self.get_or_create_user(user_id)
        insights = []
        dims = {k: round(v, 3) for k, v in user.dim_scores.items()}
        # Generate insights from actual scores
        if dims["natural_light"] >= 0.62:
            insights.append(
                "You consistently prefer brighter interiors."
                if lang == "en"
                else "Vous préférez clairement les intérieurs lumineux."
            )
        if dims["apartment_size"] >= 0.62:
            insights.append(
                "Space matters more to you than you initially stated."
                if lang == "en"
                else "L'espace compte plus pour vous que prévu initialement."
            )
        top_styles = sorted(user.style_scores.items(), key=lambda x: -x[1])[:2]
        if top_styles and top_styles[0][1] >= 0.6:
            s = top_styles[0][0].replace("_", " ")
            insights.append(
                f"Your visual taste leans toward {s} interiors."
                if lang == "en"
                else f"Vos goûts visuels penchent vers un style {s}."
            )
        top_n = sorted(user.neighborhood_scores.items(), key=lambda x: -x[1])[:2]
        if top_n and top_n[0][1] >= 0.6:
            insights.append(
                f"You gravitate toward the {top_n[0][0]}e arrondissement."
                if lang == "en"
                else f"Vous êtes attiré(e) par le {top_n[0][0]}e arrondissement."
            )
        if not insights:
            insights.append(
                "Keep swiping — your Apartment DNA will sharpen with each interaction."
                if lang == "en"
                else "Continuez à swiper — votre ADN se précisera à chaque interaction."
            )
        return TasteDNAOut(
            dimensions=dims,
            insights=insights[:5],
            style_affinity={k: round(v, 3) for k, v in sorted(user.style_scores.items(), key=lambda x: -x[1])[:8]},
            neighborhood_affinity={
                k: round(v, 3) for k, v in sorted(user.neighborhood_scores.items(), key=lambda x: -x[1])[:8]
            },
            amenity_affinity={k: round(v, 3) for k, v in sorted(user.amenity_scores.items(), key=lambda x: -x[1])[:8]},
            interaction_count=len(user.like_ids) + len(user.reject_ids),
            likes=len(user.like_ids),
            rejects=len(user.reject_ids),
        )

    def encode_query(self, query: str) -> np.ndarray:
        return np.asarray(self._encoder().encode([query], normalize_embeddings=True)[0], dtype=np.float32)

    def parse_constraints(self, query: str) -> dict[str, Any]:
        q = query.lower()
        constraints: dict[str, Any] = {}
        # Budget — support 1500, 1,500, 1 500, €1500
        m = re.search(
            r"(?:under|below|max|moins de|jusqu['’]à|<)\s*€?\s*(\d{1,2}[\s,.]\d{3}|\d{3,4})",
            q,
        )
        if not m:
            m = re.search(r"€\s*(\d{1,2}[\s,.]\d{3}|\d{3,4})", q)
        if m:
            constraints["max_rent"] = int(re.sub(r"[\s,.]", "", m.group(1)))
        # Surface
        m = re.search(r"(\d{2,3})\s*m", q)
        if m:
            constraints["min_surface"] = int(m.group(1))
        # Arrondissements
        arrs = [int(x) for x in re.findall(r"\b(\d{1,2})e\b", q)]
        arrs += [int(x) for x in re.findall(r"arrondissement\s*(\d{1,2})", q)]
        if arrs:
            constraints["arrondissements"] = [a for a in arrs if 1 <= a <= 20]
        # Style keywords
        styles = []
        for s in ["haussmannian", "haussmann", "modern", "minimalist", "industrial", "scandinavian", "bohemian"]:
            if s in q:
                styles.append("haussmannian" if "haussmann" in s else s)
        if styles:
            constraints["styles"] = styles
        if any(w in q for w in ["bright", "lumineux", "light"]):
            constraints["min_brightness"] = 0.55
        if any(w in q for w in ["parquet", "wooden floor", "hardwood"]):
            constraints["amenities"] = ["hardwood_floors"]
        if "bigger" in q or "plus grand" in q or "larger" in q:
            constraints["boost_surface"] = True
        if "further" in q or "plus loin" in q:
            constraints["relax_location"] = True
        return constraints

    def search(self, user_id: str, query: str, refine: str | None = None, limit: int = 20) -> list[dict]:
        user = self.get_or_create_user(user_id)
        self._ensure_seed_pref(user)
        full_query = query if not refine else f"{query}. {refine}"
        qvec = self.encode_query(full_query)
        constraints = self.parse_constraints(full_query)
        results = []
        for i, listing in enumerate(self.listings):
            if constraints.get("max_rent") and listing["rent_eur"] > constraints["max_rent"] * 1.1:
                continue
            if constraints.get("min_surface") and listing["surface_m2"] < constraints["min_surface"] * 0.85:
                continue
            if constraints.get("arrondissements") and not constraints.get("relax_location"):
                if listing["arrondissement"] not in constraints["arrondissements"]:
                    # soft filter — keep but penalize later
                    pass
            if constraints.get("min_brightness") and listing.get("brightness", 0) < constraints["min_brightness"] - 0.08:
                continue
            if constraints.get("styles") and listing["style"] not in constraints["styles"]:
                # soft
                pass
            if constraints.get("amenities"):
                if not set(constraints["amenities"]) & set(listing.get("amenities", [])):
                    continue

            sem = float(np.dot(qvec, self.text_emb[i]))
            personal_match, parts = self.score_listing(listing["id"], user)
            score = 0.55 * ((sem + 1) / 2) + 0.45 * (personal_match / 100)

            if constraints.get("arrondissements") and listing["arrondissement"] in constraints["arrondissements"]:
                score += 0.08
            if constraints.get("styles") and listing["style"] in constraints["styles"]:
                score += 0.07
            if constraints.get("boost_surface"):
                score += min(0.1, listing["surface_m2"] / 500)

            item = {
                **listing,
                "match_score": round(float(np.clip(score * 100, 1, 99)), 1),
                "search_similarity": round(float(sem), 4),
            }
            results.append(item)
        results.sort(key=lambda x: x["match_score"], reverse=True)
        return results[:limit]


# Singleton
engine = RecommendationEngine()
