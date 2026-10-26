#!/usr/bin/env python3
"""
Prepare a Paris-only synthetic rental demo dataset from ListingGenie.

Source: https://huggingface.co/datasets/omersh234/listinggenie-listings (MIT)
Adaptations: map cities → Paris arrondissements, convert sale prices → monthly rent,
download/store images locally, compute text embeddings, add scam test listings.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageStat
from tqdm import tqdm

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PROCESSED = DATA / "processed"
IMAGES = DATA / "images"
EMBEDDINGS = DATA / "embeddings"

PARIS_ARRONDISSEMENTS = [
    {"id": 1, "name": "Louvre", "lat": 48.8606, "lng": 2.3376, "tier": "A", "rent_m2": 42},
    {"id": 2, "name": "Bourse", "lat": 48.8687, "lng": 2.3410, "tier": "A", "rent_m2": 40},
    {"id": 3, "name": "Temple", "lat": 48.8630, "lng": 2.3590, "tier": "A", "rent_m2": 39},
    {"id": 4, "name": "Hôtel-de-Ville", "lat": 48.8540, "lng": 2.3570, "tier": "A", "rent_m2": 41},
    {"id": 5, "name": "Panthéon", "lat": 48.8448, "lng": 2.3488, "tier": "A", "rent_m2": 38},
    {"id": 6, "name": "Luxembourg", "lat": 48.8490, "lng": 2.3300, "tier": "A", "rent_m2": 43},
    {"id": 7, "name": "Palais-Bourbon", "lat": 48.8566, "lng": 2.3122, "tier": "A", "rent_m2": 42},
    {"id": 8, "name": "Élysée", "lat": 48.8742, "lng": 2.3110, "tier": "A", "rent_m2": 40},
    {"id": 9, "name": "Opéra", "lat": 48.8770, "lng": 2.3370, "tier": "B", "rent_m2": 36},
    {"id": 10, "name": "Entrepôt", "lat": 48.8760, "lng": 2.3600, "tier": "B", "rent_m2": 34},
    {"id": 11, "name": "Popincourt", "lat": 48.8580, "lng": 2.3800, "tier": "B", "rent_m2": 35},
    {"id": 12, "name": "Reuilly", "lat": 48.8410, "lng": 2.3880, "tier": "B", "rent_m2": 32},
    {"id": 13, "name": "Gobelins", "lat": 48.8320, "lng": 2.3560, "tier": "B", "rent_m2": 31},
    {"id": 14, "name": "Observatoire", "lat": 48.8330, "lng": 2.3270, "tier": "B", "rent_m2": 33},
    {"id": 15, "name": "Vaugirard", "lat": 48.8410, "lng": 2.3000, "tier": "B", "rent_m2": 34},
    {"id": 16, "name": "Passy", "lat": 48.8630, "lng": 2.2760, "tier": "A", "rent_m2": 39},
    {"id": 17, "name": "Batignolles-Monceau", "lat": 48.8870, "lng": 2.3070, "tier": "B", "rent_m2": 35},
    {"id": 18, "name": "Butte-Montmartre", "lat": 48.8920, "lng": 2.3440, "tier": "B", "rent_m2": 33},
    {"id": 19, "name": "Buttes-Chaumont", "lat": 48.8820, "lng": 2.3820, "tier": "C", "rent_m2": 30},
    {"id": 20, "name": "Ménilmontant", "lat": 48.8650, "lng": 2.3990, "tier": "C", "rent_m2": 29},
]

STYLE_MAP = {
    "modern": "modern",
    "contemporary": "modern",
    "minimalist": "minimalist",
    "scandinavian": "scandinavian",
    "industrial": "industrial",
    "classic": "haussmannian",
    "traditional": "haussmannian",
    "luxury": "luxury",
    "bohemian": "bohemian",
    "rustic": "rustic",
    "art deco": "art_deco",
    "mid-century": "mid_century",
}

AMENITY_FR = {
    "balcony": "balcony",
    "terrace": "terrace",
    "elevator": "elevator",
    "parking": "parking",
    "dishwasher": "dishwasher",
    "washer": "washer",
    "dryer": "dryer",
    "ac": "air_conditioning",
    "fireplace": "fireplace",
    "garden": "garden",
    "gym": "gym",
    "pool": "pool",
    "hardwood": "hardwood_floors",
    "parquet": "hardwood_floors",
    "furnished": "furnished",
}


def estimate_brightness(img: Image.Image) -> float:
    gray = img.convert("L")
    return float(ImageStat.Stat(gray).mean[0]) / 255.0


def estimate_warmth(img: Image.Image) -> float:
    rgb = np.asarray(img.convert("RGB").resize((64, 64)), dtype=np.float32)
    r, g, b = rgb[:, :, 0].mean(), rgb[:, :, 1].mean(), rgb[:, :, 2].mean()
    return float(np.clip((r - b) / 255.0 + 0.5, 0, 1))


def normalize_amenities(raw) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            raw = [a.strip() for a in raw.split(",")]
    out = []
    for a in raw:
        key = str(a).lower().strip()
        mapped = None
        for k, v in AMENITY_FR.items():
            if k in key:
                mapped = v
                break
        out.append(mapped or re.sub(r"[^a-z0-9_]+", "_", key)[:40])
    return sorted(set(x for x in out if x))


def map_style(style: str | None) -> str:
    if not style:
        return "modern"
    s = style.lower().strip()
    for k, v in STYLE_MAP.items():
        if k in s:
            return v
    return "modern"


def assign_arrondissement(rng: random.Random, style: str, sqm: int, rooms: int):
    # Bias luxury/classic toward central arrondissements
    if style in {"luxury", "haussmannian"}:
        pool = [a for a in PARIS_ARRONDISSEMENTS if a["tier"] == "A"]
    elif style in {"industrial", "bohemian"}:
        pool = [a for a in PARIS_ARRONDISSEMENTS if a["id"] in {10, 11, 18, 19, 20}]
    elif sqm >= 90 or rooms >= 4:
        pool = [a for a in PARIS_ARRONDISSEMENTS if a["tier"] in {"A", "B"}]
    else:
        pool = PARIS_ARRONDISSEMENTS
    return rng.choice(pool)


def sale_to_rent(price_usd: int, sqm: int, rent_m2: float, rng: random.Random) -> int:
    # Convert synthetic sale price into plausible Paris monthly rent
    eur = price_usd * 0.92
    # Cap using local €/m² reference with noise
    base = sqm * rent_m2 * rng.uniform(0.85, 1.15)
    # Mild influence from original price band
    band = 900 + (eur / 2_500_000) * 3500
    rent = 0.65 * base + 0.35 * band
    return int(max(650, min(6500, round(rent / 10) * 10)))


def build_tags(style: str, brightness: float, amenities: list[str], furnished: bool) -> list[str]:
    tags = []
    if brightness >= 0.62:
        tags.append("bright")
    elif brightness <= 0.42:
        tags.append("cozy")
    style_tags = {
        "haussmannian": "haussmannian",
        "modern": "modern",
        "minimalist": "minimalist",
        "scandinavian": "scandinavian",
        "industrial": "industrial",
        "luxury": "luxury",
        "bohemian": "bohemian",
        "art_deco": "art_deco",
    }
    if style in style_tags:
        tags.append(style_tags[style])
    if "hardwood_floors" in amenities or "parquet" in amenities:
        tags.append("parquet")
    if "balcony" in amenities or "terrace" in amenities:
        tags.append("balcony")
    if furnished:
        tags.append("furnished")
    return tags[:5]


def listing_text(rec: dict) -> str:
    am = ", ".join(rec["amenities"][:8])
    return (
        f"{rec['title']}. {rec['description']} "
        f"Located in Paris {rec['arrondissement']}e ({rec['neighborhood']}). "
        f"{rec['rooms']} rooms, {rec['surface_m2']} m², {rec['rent_eur']}/month. "
        f"Style: {rec['style']}. Amenities: {am}. Tags: {', '.join(rec['tags'])}."
    )


def make_scam_listings(rng: random.Random, templates: list[dict], start_idx: int) -> list[dict]:
    scams = []
    scenarios = [
        {
            "risk": "high",
            "rent_factor": 0.35,
            "title": "URGENT — Dream flat available NOW, wire deposit today",
            "description": (
                "Beautiful apartment must rent immediately. Owner abroad, no viewing needed. "
                "Send first month + deposit via Western Union before keys. Perfect deal, act fast!!!"
            ),
            "signals": ["below_market", "payment_before_visit", "urgency", "suspicious_wording"],
        },
        {
            "risk": "high",
            "rent_factor": 0.4,
            "title": "Luxury Paris apartment — too good to miss",
            "description": (
                "Stunning fully renovated apartment. Pay agency fees upfront by bank transfer "
                "to secure viewing. Landlord traveling, unavailable for visits this month."
            ),
            "signals": ["below_market", "payment_before_visit", "inconsistent_info"],
        },
        {
            "risk": "medium",
            "rent_factor": 0.55,
            "title": "Charming studio, flexible terms",
            "description": (
                "Nice studio available. Prefer cash deposit. Photos may differ slightly from "
                "current condition. Contact quickly as many applicants."
            ),
            "signals": ["below_market", "suspicious_wording", "missing_details"],
        },
        {
            "risk": "medium",
            "rent_factor": 0.6,
            "title": "Spacious apartment near metro",
            "description": (
                "Large bright apartment. Incomplete listing — surface to confirm. "
                "Deposit required to hold the property before visit."
            ),
            "signals": ["payment_before_visit", "missing_details", "inconsistent_info"],
        },
        {
            "risk": "high",
            "rent_factor": 0.3,
            "title": "EXCEPTIONAL OFFER — 3 rooms Paris center",
            "description": (
                "Incredible price for Paris center. Contact WhatsApp only. "
                "Must transfer guarantee before appointment. No agency, private owner overseas."
            ),
            "signals": ["below_market", "payment_before_visit", "urgency", "suspicious_wording"],
        },
    ]
    for i, scen in enumerate(scenarios):
        base = templates[i % len(templates)].copy()
        arr = next(a for a in PARIS_ARRONDISSEMENTS if a["id"] == base["arrondissement"])
        fair = int(base["surface_m2"] * arr["rent_m2"])
        rent = max(400, int(fair * scen["rent_factor"]))
        lid = f"SCAM{start_idx + i:03d}"
        rec = {
            **base,
            "id": lid,
            "listing_id": lid,
            "title": scen["title"],
            "description": scen["description"],
            "rent_eur": rent,
            "is_synthetic": True,
            "is_scam_test": True,
            "scam_label": scen["risk"],
            "injected_scam_signals": scen["signals"],
            "reference_rent_m2": arr["rent_m2"],
            "tags": ["deal"] + base.get("tags", [])[:3],
        }
        rec["embedding_text"] = listing_text(rec)
        scams.append(rec)
    return scams


def compute_embeddings(texts: list[str], model_name: str) -> np.ndarray:
    from sentence_transformers import SentenceTransformer

    print(f"Loading text model: {model_name}")
    model = SentenceTransformer(model_name)
    emb = model.encode(texts, batch_size=64, show_progress_bar=True, normalize_embeddings=True)
    return np.asarray(emb, dtype=np.float32)


def compute_visual_features(image_paths: list[Path]) -> np.ndarray:
    """Lightweight visual feature vectors: brightness, warmth, contrast, edge energy, palette."""
    feats = []
    for path in tqdm(image_paths, desc="Visual features"):
        img = Image.open(path).convert("RGB").resize((128, 128))
        arr = np.asarray(img, dtype=np.float32) / 255.0
        brightness = arr.mean()
        warmth = float((arr[:, :, 0].mean() - arr[:, :, 2].mean()) + 0.5)
        contrast = float(arr.std())
        # Simple edge energy via gradient magnitude
        gy, gx = np.gradient(arr.mean(axis=2))
        edges = float(np.sqrt(gx**2 + gy**2).mean())
        # Dominant channel means (proxy for materials/finishes)
        r, g, b = arr[:, :, 0].mean(), arr[:, :, 1].mean(), arr[:, :, 2].mean()
        # Saturation proxy
        mx = arr.max(axis=2)
        mn = arr.min(axis=2)
        sat = float(((mx - mn) / (mx + 1e-6)).mean())
        feats.append([brightness, warmth, contrast, edges, r, g, b, sat])
    return np.asarray(feats, dtype=np.float32)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=400)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--model", default="sentence-transformers/all-MiniLM-L6-v2")
    parser.add_argument("--skip-download", action="store_true")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    np.random.seed(args.seed)

    for d in (PROCESSED, IMAGES, EMBEDDINGS, DATA / "raw"):
        d.mkdir(parents=True, exist_ok=True)

    print("Loading ListingGenie dataset from Hugging Face…")
    from datasets import load_dataset

    ds = load_dataset("omersh234/listinggenie-listings", split="train")
    indices = list(range(len(ds)))
    rng.shuffle(indices)
    indices = indices[: args.count]

    listings = []
    image_paths = []

    for n, idx in enumerate(tqdm(indices, desc="Adapting listings")):
        row = ds[int(idx)]
        style = map_style(row.get("style"))
        sqm = int(row.get("sqm") or 40)
        rooms = int(row.get("rooms") or 1)
        # Paris rentals: studios often 1 pièce; clamp oversized synthetic sqm a bit
        if rooms == 1:
            sqm = min(sqm, 45)
        elif rooms == 2:
            sqm = min(max(sqm, 28), 70)
        else:
            sqm = min(max(sqm, 45), 140)

        arr = assign_arrondissement(rng, style, sqm, rooms)
        rent = sale_to_rent(int(row.get("price_usd") or 500000), sqm, arr["rent_m2"], rng)
        amenities = normalize_amenities(row.get("amenities"))
        furnished = "furnished" in amenities or rng.random() < 0.45
        if furnished and "furnished" not in amenities:
            amenities.append("furnished")

        prop = str(row.get("property_type") or "apartment").lower()
        if "studio" in prop or rooms == 1:
            apt_type = "studio"
        elif "loft" in prop:
            apt_type = "loft"
        elif "duplex" in prop:
            apt_type = "duplex"
        else:
            apt_type = "apartment"

        lid = f"SN{n:04d}"
        img = row["image"]
        if not isinstance(img, Image.Image):
            img = Image.open(img).convert("RGB")
        else:
            img = img.convert("RGB")

        # Slight resize for web
        img = img.resize((768, 768), Image.Resampling.LANCZOS)
        brightness = estimate_brightness(img)
        warmth = estimate_warmth(img)
        out_path = IMAGES / f"{lid}.jpg"
        img.save(out_path, "JPEG", quality=86, optimize=True)
        image_paths.append(out_path)

        # Jitter coordinates within arrondissement
        lat = arr["lat"] + rng.uniform(-0.008, 0.008)
        lng = arr["lng"] + rng.uniform(-0.01, 0.01)

        title = str(row.get("title") or f"Apartment in Paris {arr['id']}e")
        # Soften non-Paris city mentions
        title = re.sub(r"\b(New York|London|Berlin|Madrid|Rome|Tokyo|Chicago|Miami)\b", "Paris", title, flags=re.I)
        desc = str(row.get("description") or "")
        desc = re.sub(r"\b(New York|London|Berlin|Madrid|Rome|Tokyo|Chicago|Miami)\b", "Paris", desc, flags=re.I)

        floor = int(row.get("floor") or rng.randint(0, 6))
        tags = build_tags(style, brightness, amenities, furnished)

        rec = {
            "id": lid,
            "listing_id": str(row.get("listing_id") or lid),
            "title": title,
            "description": desc,
            "rent_eur": rent,
            "surface_m2": sqm,
            "rooms": rooms,
            "bedrooms": max(0, rooms - 1),
            "floor": floor,
            "arrondissement": arr["id"],
            "neighborhood": arr["name"],
            "city": "Paris",
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "style": style,
            "condition": str(row.get("condition") or "good").lower(),
            "vibe": str(row.get("vibe") or "calm").lower(),
            "property_type": apt_type,
            "furnished": furnished,
            "amenities": amenities,
            "tags": tags,
            "image": f"/api/images/{lid}.jpg",
            "image_file": f"{lid}.jpg",
            "brightness": round(brightness, 3),
            "warmth": round(warmth, 3),
            "is_synthetic": True,
            "is_scam_test": False,
            "scam_label": "low",
            "injected_scam_signals": [],
            "reference_rent_m2": arr["rent_m2"],
            "source": "omersh234/listinggenie-listings",
        }
        rec["embedding_text"] = listing_text(rec)
        listings.append(rec)

    # Add scam variants (reuse images from first templates)
    scams = make_scam_listings(rng, listings[:10], start_idx=0)
    for scam in scams:
        # Point to an existing image file
        donor = listings[int(scam["id"][-3:]) % len(listings)]
        scam["image"] = donor["image"]
        scam["image_file"] = donor["image_file"]
        scam["brightness"] = donor["brightness"]
        scam["warmth"] = donor["warmth"]
        listings.append(scam)

    # Paris rent reference table (public-statistical approximation for demo risk scoring)
    rent_refs = {
        str(a["id"]): {"arrondissement": a["id"], "name": a["name"], "eur_per_m2": a["rent_m2"]}
        for a in PARIS_ARRONDISSEMENTS
    }

    texts = [r["embedding_text"] for r in listings]
    text_emb = compute_embeddings(texts, args.model)

    # Visual features for non-scam images; for scams reuse donor features
    unique_files = []
    file_to_idx = {}
    for r in listings:
        f = r["image_file"]
        if f not in file_to_idx:
            file_to_idx[f] = len(unique_files)
            unique_files.append(IMAGES / f)
    vis_unique = compute_visual_features(unique_files)
    vis_emb = np.stack([vis_unique[file_to_idx[r["image_file"]]] for r in listings])

    # Normalize visual features
    vis_mean = vis_emb.mean(axis=0)
    vis_std = vis_emb.std(axis=0) + 1e-6
    vis_emb = (vis_emb - vis_mean) / vis_std

    # Style one-hots for interpretable DNA
    styles = sorted({r["style"] for r in listings})
    style_index = {s: i for i, s in enumerate(styles)}

    meta = {
        "count": len(listings),
        "text_model": args.model,
        "text_dim": int(text_emb.shape[1]),
        "visual_dim": int(vis_emb.shape[1]),
        "styles": styles,
        "style_index": style_index,
        "source": "omersh234/listinggenie-listings",
        "license": "MIT",
        "note": "Synthetic demonstration data adapted to Paris rentals. Not real listings.",
        "seed": args.seed,
    }

    with open(PROCESSED / "listings.json", "w", encoding="utf-8") as f:
        json.dump(listings, f, ensure_ascii=False, indent=2)
    with open(PROCESSED / "rent_references.json", "w", encoding="utf-8") as f:
        json.dump(rent_refs, f, ensure_ascii=False, indent=2)
    with open(PROCESSED / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    np.save(EMBEDDINGS / "text_embeddings.npy", text_emb)
    np.save(EMBEDDINGS / "visual_features.npy", vis_emb)
    np.save(EMBEDDINGS / "visual_mean.npy", vis_mean.astype(np.float32))
    np.save(EMBEDDINGS / "visual_std.npy", vis_std.astype(np.float32))
    with open(EMBEDDINGS / "listing_ids.json", "w") as f:
        json.dump([r["id"] for r in listings], f)

    print(f"Wrote {len(listings)} listings → {PROCESSED}")
    print(f"Images → {IMAGES}")
    print(f"Embeddings → {EMBEDDINGS}")


if __name__ == "__main__":
    main()
