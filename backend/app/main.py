from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.models.schemas import (
    ApplicationRequest,
    CompareRequest,
    ExplanationOut,
    OnboardingRequest,
    SearchRequest,
    SwipeRequest,
    TasteDNAOut,
    UserPreferences,
    UserStateOut,
)
from app.services.compare import compare_listings
from app.services.copilot import generate_application
from app.services.scam import assess_listing

app = FastAPI(title="SwipeNest AI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        from app.services.recommender import RecommendationEngine

        _engine = RecommendationEngine()
    return _engine


def enrich(listing: dict, user_id: str = "default") -> dict:
    engine = get_engine()
    user = engine.get_or_create_user(user_id)
    match, _ = engine.score_listing(listing["id"], user)
    scam = assess_listing(listing, user.preferences.language)
    out = {k: v for k, v in listing.items() if k not in {"embedding_text", "image_file", "injected_scam_signals"}}
    out["match_score"] = round(match, 1)
    out["scam_risk"] = scam.risk
    out["scam_score"] = scam.score
    return out


def user_state(user_id: str = "default") -> UserStateOut:
    engine = get_engine()
    user = engine.get_or_create_user(user_id)
    return UserStateOut(
        preferences=user.preferences,
        swipe_count=len(user.like_ids) + len(user.reject_ids),
        likes=user.like_ids,
        rejects=user.reject_ids,
        favorites=user.favorites,
        last_swipe_id=user.last_swipe_id,
        onboarding_complete=user.onboarding_complete,
    )


@app.get("/api/health")
def health():
    ready = (settings.processed_dir / "listings.json").exists()
    return {
        "status": "ok",
        "data_ready": ready,
        "app": settings.app_name,
        "gemini_configured": bool(settings.gemini_api_key),
        "gemini_model": settings.gemini_model,
    }


@app.post("/api/onboarding")
def onboarding(body: OnboardingRequest, user_id: str = Query("default")):
    engine = get_engine()
    engine.apply_onboarding(user_id, body.preferences, demo=body.demo_profile)
    return {"ok": True, "state": user_state(user_id)}


@app.get("/api/user")
def get_user(user_id: str = Query("default")):
    return user_state(user_id)


@app.put("/api/user/preferences")
def update_prefs(prefs: UserPreferences, user_id: str = Query("default")):
    engine = get_engine()
    user = engine.get_or_create_user(user_id)
    user.preferences = prefs
    user.onboarding_complete = True
    return user_state(user_id)


@app.post("/api/user/reset")
def reset_user(user_id: str = Query("default")):
    engine = get_engine()
    engine.reset_user(user_id)
    return user_state(user_id)


@app.get("/api/feed")
def feed(user_id: str = Query("default"), limit: int = Query(25, ge=1, le=100)):
    engine = get_engine()
    items = engine.feed(user_id, limit=limit)
    return {"items": [enrich(x, user_id) for x in items]}


@app.get("/api/listings/{listing_id}")
def get_listing(listing_id: str, user_id: str = Query("default")):
    engine = get_engine()
    listing = engine.listing_by_id.get(listing_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    return enrich(listing, user_id)


@app.get("/api/listings")
def list_all(
    user_id: str = Query("default"),
    arrondissement: int | None = None,
    max_rent: int | None = None,
    limit: int = Query(100, ge=1, le=500),
):
    engine = get_engine()
    items = []
    for listing in engine.listings:
        if arrondissement and listing["arrondissement"] != arrondissement:
            continue
        if max_rent and listing["rent_eur"] > max_rent:
            continue
        items.append(enrich(listing, user_id))
        if len(items) >= limit:
            break
    return {"items": items}


@app.post("/api/swipe")
def swipe(body: SwipeRequest, user_id: str = Query("default")):
    engine = get_engine()
    try:
        engine.record_swipe(user_id, body.listing_id, body.action, body.reason)
    except KeyError:
        raise HTTPException(404, "Listing not found")
    return {
        "ok": True,
        "state": user_state(user_id),
        "taste_dna": engine.taste_dna(user_id, engine.get_or_create_user(user_id).preferences.language),
    }


@app.post("/api/swipe/undo")
def undo(user_id: str = Query("default")):
    engine = get_engine()
    engine.undo(user_id)
    return {"ok": True, "state": user_state(user_id)}


@app.post("/api/favorites/{listing_id}")
def add_favorite(listing_id: str, user_id: str = Query("default")):
    engine = get_engine()
    user = engine.get_or_create_user(user_id)
    if listing_id not in engine.listing_by_id:
        raise HTTPException(404, "Listing not found")
    if listing_id not in user.favorites:
        user.favorites.append(listing_id)
    return {"favorites": user.favorites}


@app.delete("/api/favorites/{listing_id}")
def remove_favorite(listing_id: str, user_id: str = Query("default")):
    engine = get_engine()
    user = engine.get_or_create_user(user_id)
    user.favorites = [x for x in user.favorites if x != listing_id]
    return {"favorites": user.favorites}


@app.get("/api/favorites")
def favorites(user_id: str = Query("default")):
    engine = get_engine()
    user = engine.get_or_create_user(user_id)
    items = [enrich(engine.listing_by_id[lid], user_id) for lid in user.favorites if lid in engine.listing_by_id]
    return {"items": items}


@app.get("/api/explain/{listing_id}", response_model=ExplanationOut)
def explain(listing_id: str, user_id: str = Query("default")):
    engine = get_engine()
    if listing_id not in engine.listing_by_id:
        raise HTTPException(404, "Listing not found")
    lang = engine.get_or_create_user(user_id).preferences.language
    return engine.explain(user_id, listing_id, lang)


@app.get("/api/taste-dna", response_model=TasteDNAOut)
def taste_dna(user_id: str = Query("default")):
    engine = get_engine()
    lang = engine.get_or_create_user(user_id).preferences.language
    return engine.taste_dna(user_id, lang)


@app.post("/api/taste-dna/reset")
def reset_dna(user_id: str = Query("default")):
    engine = get_engine()
    user = engine.get_or_create_user(user_id)
    # Keep preferences, clear learned signals
    prefs = user.preferences
    onboarding = user.onboarding_complete
    engine.reset_user(user_id)
    user = engine.get_or_create_user(user_id)
    user.preferences = prefs
    user.onboarding_complete = onboarding
    return engine.taste_dna(user_id, prefs.language)


@app.post("/api/search")
def search(body: SearchRequest, user_id: str = Query("default")):
    engine = get_engine()
    items = engine.search(user_id, body.query, body.refine, body.limit)
    return {"items": [enrich(x, user_id) for x in items], "query": body.query, "refine": body.refine}


@app.get("/api/scam/{listing_id}")
def scam(listing_id: str, user_id: str = Query("default")):
    engine = get_engine()
    listing = engine.listing_by_id.get(listing_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    lang = engine.get_or_create_user(user_id).preferences.language
    return assess_listing(listing, lang)


@app.post("/api/apply")
def apply(body: ApplicationRequest, user_id: str = Query("default")):
    engine = get_engine()
    listing = engine.listing_by_id.get(body.listing_id)
    if not listing:
        raise HTTPException(404, "Listing not found")
    user = engine.get_or_create_user(user_id)
    return generate_application(listing, user.preferences, body.tone, body.language)


@app.post("/api/compare")
def compare(body: CompareRequest, user_id: str = Query("default")):
    engine = get_engine()
    lang = engine.get_or_create_user(user_id).preferences.language
    return compare_listings(engine, user_id, body.listing_ids, lang)


@app.get("/api/map")
def map_points(user_id: str = Query("default"), limit: int = Query(200, ge=1, le=500)):
    engine = get_engine()
    ranked = engine.rank(user_id, limit=limit, include_seen=True)
    points = []
    for item in ranked:
        scam = assess_listing(item, engine.get_or_create_user(user_id).preferences.language)
        points.append(
            {
                "id": item["id"],
                "lat": item["lat"],
                "lng": item["lng"],
                "rent_eur": item["rent_eur"],
                "title": item["title"],
                "image": item["image"],
                "arrondissement": item["arrondissement"],
                "match_score": item["match_score"],
                "scam_risk": scam.risk,
            }
        )
    return {"points": points}


@app.get("/api/images/{filename}")
def images(filename: str):
    path = settings.images_dir / filename
    if not path.exists() or ".." in filename:
        raise HTTPException(404, "Image not found")
    return FileResponse(path, media_type="image/jpeg")


@app.get("/api/demo/adaptation")
def adaptation_demo(user_id: str = Query("default")):
    """Observe how top recommendations shift — useful for evaluation / demos."""
    engine = get_engine()
    before = [
        {"id": x["id"], "match_score": x["match_score"], "title": x["title"]}
        for x in engine.rank(user_id, limit=5)
    ]
    return {
        "top": before,
        "weights": engine.get_or_create_user(user_id).weights,
        "biases": {
            "rent_bias": engine.get_or_create_user(user_id).rent_bias,
            "surface_bias": engine.get_or_create_user(user_id).surface_bias,
            "brightness_bias": engine.get_or_create_user(user_id).brightness_bias,
        },
        "interaction_count": len(engine.get_or_create_user(user_id).like_ids)
        + len(engine.get_or_create_user(user_id).reject_ids),
    }


if settings.images_dir.exists():
    app.mount("/static/images", StaticFiles(directory=str(settings.images_dir)), name="images")
