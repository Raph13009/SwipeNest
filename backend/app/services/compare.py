from __future__ import annotations

from typing import Any

from app.services.recommender import RecommendationEngine


def compare_listings(engine: RecommendationEngine, user_id: str, listing_ids: list[str], lang: str = "en") -> dict[str, Any]:
    user = engine.get_or_create_user(user_id)
    items = []
    for lid in listing_ids[:3]:
        listing = engine.listing_by_id.get(lid)
        if not listing:
            continue
        match, parts = engine.score_listing(lid, user)
        items.append({"listing": listing, "match_score": round(match, 1), "parts": parts})

    if len(items) < 2:
        return {"items": items, "insights": [], "winner_id": items[0]["listing"]["id"] if items else None}

    # Trade-off highlights vs user priorities
    insights = []
    by_budget = sorted(items, key=lambda x: x["listing"]["rent_eur"])
    by_surface = sorted(items, key=lambda x: -x["listing"]["surface_m2"])
    by_match = sorted(items, key=lambda x: -x["match_score"])

    cheapest = by_budget[0]["listing"]
    largest = by_surface[0]["listing"]
    best = by_match[0]["listing"]

    if lang == "fr":
        insights.append(f"{cheapest['title']} est le plus accessible ({cheapest['rent_eur']} €/mois).")
        insights.append(f"{largest['title']} offre le plus d'espace ({largest['surface_m2']} m²).")
        insights.append(f"{best['title']} est le meilleur alignement global avec vos priorités ({by_match[0]['match_score']}%).")
        # relative tradeoffs
        for it in items:
            L = it["listing"]
            if L["rent_eur"] > user.preferences.max_rent:
                insights.append(f"{L['title']} dépasse votre budget max.")
            if L["surface_m2"] < user.preferences.min_surface:
                insights.append(f"{L['title']} est sous votre surface minimale.")
    else:
        insights.append(f"{cheapest['title']} is the most affordable (€{cheapest['rent_eur']}/mo).")
        insights.append(f"{largest['title']} offers the most space ({largest['surface_m2']} m²).")
        insights.append(f"{best['title']} is the strongest overall fit for your priorities ({by_match[0]['match_score']}%).")
        for it in items:
            L = it["listing"]
            if L["rent_eur"] > user.preferences.max_rent:
                insights.append(f"{L['title']} exceeds your max budget.")
            if L["surface_m2"] < user.preferences.min_surface:
                insights.append(f"{L['title']} is below your minimum surface.")

    # Deduplicate while preserving order
    seen = set()
    uniq = []
    for i in insights:
        if i not in seen:
            seen.add(i)
            uniq.append(i)

    return {
        "items": [
            {
                "id": it["listing"]["id"],
                "title": it["listing"]["title"],
                "rent_eur": it["listing"]["rent_eur"],
                "surface_m2": it["listing"]["surface_m2"],
                "rooms": it["listing"]["rooms"],
                "arrondissement": it["listing"]["arrondissement"],
                "neighborhood": it["listing"]["neighborhood"],
                "style": it["listing"]["style"],
                "image": it["listing"]["image"],
                "match_score": it["match_score"],
                "budget_fit": round(it["parts"]["budget"], 3),
                "location_fit": round(it["parts"]["location"], 3),
                "surface_fit": round(it["parts"]["surface"], 3),
                "style_fit": round(it["parts"]["style"], 3),
            }
            for it in items
        ],
        "insights": uniq[:6],
        "winner_id": best["id"],
    }
