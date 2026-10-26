import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.models.schemas import UserPreferences
from app.services.recommender import RecommendationEngine
from app.services.scam import assess_listing


@pytest.fixture(scope="module")
def engine():
    return RecommendationEngine()


def test_dataset_loaded(engine):
    assert len(engine.listings) >= 100
    assert engine.text_emb.shape[0] == len(engine.listings)


def test_swipe_updates_preferences(engine):
    uid = "test_adapt"
    engine.reset_user(uid)
    engine.apply_onboarding(
        uid,
        UserPreferences(
            name="Test",
            max_rent=2000,
            min_surface=25,
            arrondissements=[11],
            dream_description="bright modern apartment",
        ),
    )
    before = engine.rank(uid, limit=5)
    target = before[0]
    engine.record_swipe(uid, target["id"], "like")
    dna = engine.taste_dna(uid)
    assert dna.likes == 1
    assert dna.interaction_count == 1


def test_rejection_reason_too_dark_raises_brightness_bias(engine):
    uid = "test_dark"
    engine.reset_user(uid)
    engine.apply_onboarding(uid, UserPreferences(name="T", max_rent=2500, min_surface=20))
    dark = sorted(engine.listings, key=lambda x: x.get("brightness", 1))[0]
    before = engine.get_or_create_user(uid).brightness_bias
    engine.record_swipe(uid, dark["id"], "reject", "too_dark")
    after = engine.get_or_create_user(uid).brightness_bias
    assert after > before


def test_explanation_uses_real_factors(engine):
    uid = "test_explain"
    engine.reset_user(uid)
    engine.apply_onboarding(uid, UserPreferences(name="T", max_rent=1800, min_surface=30, arrondissements=[11, 10]))
    lid = engine.rank(uid, limit=1)[0]["id"]
    exp = engine.explain(uid, lid)
    assert exp.match_score > 0
    assert len(exp.factors) >= 5
    assert any(f.key == "budget" for f in exp.factors)


def test_search_parses_budget(engine):
    uid = "test_search"
    engine.reset_user(uid)
    engine.apply_onboarding(uid, UserPreferences(name="T", max_rent=3000, min_surface=20))
    results = engine.search(uid, "Bright apartment under €1200", limit=10)
    assert results
    assert all(r["rent_eur"] <= 1320 for r in results)


def test_scam_high_on_synthetic(engine):
    scams = [L for L in engine.listings if L.get("is_scam_test") and L.get("scam_label") == "high"]
    assert scams
    assessed = assess_listing(scams[0])
    assert assessed.risk in {"medium", "high"}
    assert assessed.signals
