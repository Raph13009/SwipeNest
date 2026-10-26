#!/usr/bin/env python3
"""
Evaluate adaptive recommendations against a non-personalized baseline.

Metrics are computed on the synthetic Paris demo dataset only.
Never invents accuracy — prints observed ranking metrics.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.models.schemas import UserPreferences
from app.services.recommender import RecommendationEngine


def ndcg_at_k(relevances: list[float], k: int = 10) -> float:
    rel = np.asarray(relevances[:k], dtype=float)
    if rel.size == 0:
        return 0.0
    discounts = 1.0 / np.log2(np.arange(2, rel.size + 2))
    dcg = float(np.sum(rel * discounts))
    ideal = np.sort(rel)[::-1]
    idcg = float(np.sum(ideal * discounts))
    return dcg / idcg if idcg > 0 else 0.0


def main():
    engine = RecommendationEngine()
    user_id = "eval_user"
    engine.reset_user(user_id)
    prefs = UserPreferences(
        name="Eval",
        max_rent=1600,
        min_surface=30,
        arrondissements=[11, 10, 3],
        apartment_types=["apartment", "studio"],
        aesthetic=["bright", "haussmannian"],
        amenities=["hardwood_floors", "balcony"],
        dream_description="Bright Haussmannian apartment with wooden floors under 1600 euros",
        language="en",
    )
    engine.apply_onboarding(user_id, prefs)

    # Baseline: rank by rent ascending within budget (non-personalized)
    candidates = [
        L for L in engine.listings if L["rent_eur"] <= prefs.max_rent * 1.1 and L["surface_m2"] >= prefs.min_surface * 0.85
    ]
    baseline = sorted(candidates, key=lambda x: x["rent_eur"])[:20]

    # Simulate likes on bright + preferred-style apartments
    liked = [
        L
        for L in candidates
        if L.get("brightness", 0) >= 0.58 and L["style"] in {"haussmannian", "modern", "scandinavian"}
    ][:8]
    for L in liked:
        engine.record_swipe(user_id, L["id"], "like")

    # Reject dark / expensive with reasons
    dark = [L for L in candidates if L.get("brightness", 1) < 0.42][:3]
    for L in dark:
        engine.record_swipe(user_id, L["id"], "reject", "too_dark")
    expensive = [L for L in candidates if L["rent_eur"] > prefs.max_rent * 0.95][:2]
    for L in expensive:
        if L["id"] not in {x["id"] for x in liked}:
            engine.record_swipe(user_id, L["id"], "reject", "too_expensive")

    adaptive = engine.rank(user_id, limit=20)

    def relevance(listing: dict) -> float:
        score = 0.0
        if listing.get("brightness", 0) >= 0.55:
            score += 1.0
        if listing["style"] in {"haussmannian", "modern", "scandinavian"}:
            score += 1.0
        if listing["arrondissement"] in prefs.arrondissements:
            score += 0.5
        if "hardwood_floors" in listing.get("amenities", []):
            score += 0.5
        return score

    base_rel = [relevance(x) for x in baseline]
    adapt_rel = [relevance(x) for x in adaptive]

    # Rejection reason effect: after too_dark, mean brightness of top-10 should rise
    top_brightness = float(np.mean([x.get("brightness", 0.5) for x in adaptive[:10]]))
    baseline_brightness = float(np.mean([x.get("brightness", 0.5) for x in baseline[:10]]))

    # Scam detection validation on labeled synthetic scams
    from app.services.scam import assess_listing

    scam_listings = [L for L in engine.listings if L.get("is_scam_test")]
    correct = 0
    for L in scam_listings:
        pred = assess_listing(L)
        label = L.get("scam_label", "low")
        if label == "high" and pred.risk in {"high", "medium"}:
            correct += 1
        elif label == "medium" and pred.risk in {"medium", "high"}:
            correct += 1
        elif label == "low" and pred.risk == "low":
            correct += 1

    report = {
        "n_listings": len(engine.listings),
        "n_liked_simulated": len(liked),
        "baseline_ndcg@10": round(ndcg_at_k(base_rel, 10), 4),
        "adaptive_ndcg@10": round(ndcg_at_k(adapt_rel, 10), 4),
        "baseline_mean_relevance@10": round(float(np.mean(base_rel[:10])), 4),
        "adaptive_mean_relevance@10": round(float(np.mean(adapt_rel[:10])), 4),
        "baseline_top10_mean_brightness": round(baseline_brightness, 4),
        "adaptive_top10_mean_brightness_after_too_dark": round(top_brightness, 4),
        "brightness_lift": round(top_brightness - baseline_brightness, 4),
        "scam_labeled": len(scam_listings),
        "scam_detection_recall_proxy": round(correct / max(len(scam_listings), 1), 4),
        "note": "Relevance is a handcrafted proxy aligned with the simulated user taste; not a claim of production accuracy.",
    }

    out = ROOT / "docs" / "evaluation_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
