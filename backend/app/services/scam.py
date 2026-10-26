from __future__ import annotations

import re
from typing import Any

from app.models.schemas import ScamAssessment
from app.services import data_store

SUSPICIOUS_PATTERNS = [
    (r"western\s*union|wire\s*transfer|whatsapp\s*only|bank\s*transfer\s*before", "payment_before_visit", 0.35),
    (r"no\s*viewing|without\s*visit|no\s*visit\s*needed|unavailable\s*for\s*visits", "payment_before_visit", 0.25),
    (r"urgent|act\s*fast|immediately|must\s*rent\s*immediately|exceptional\s*offer", "urgency", 0.2),
    (r"owner\s*abroad|traveling|overseas|private\s*owner\s*overseas", "suspicious_wording", 0.15),
    (r"cash\s*deposit|deposit\s*required\s*to\s*hold|pay\s*.*before", "payment_before_visit", 0.25),
    (r"photos?\s*may\s*differ|incomplete\s*listing|surface\s*to\s*confirm", "inconsistent_info", 0.15),
    (r"!!!+|too\s*good\s*to\s*miss", "suspicious_wording", 0.1),
]

ADVICE = {
    "en": {
        "low": [
            "Still verify the landlord identity and schedule an in-person visit.",
            "Never send money before seeing the apartment and signing a contract.",
        ],
        "medium": [
            "Ask for a live video tour and official ownership documents.",
            "Compare the rent to local references for this arrondissement.",
            "Avoid any payment before a signed lease.",
        ],
        "high": [
            "Treat this listing as high risk until proven otherwise.",
            "Do not transfer deposits or fees before an in-person visit.",
            "Prefer established agencies and refuse pressure tactics.",
        ],
        "disclaimer": (
            "A risk score is not proof of fraud. SwipeNest AI highlights warning signs "
            "to help you stay cautious — always verify independently."
        ),
    },
    "fr": {
        "low": [
            "Vérifiez toujours l'identité du propriétaire et visitez sur place.",
            "Ne versez jamais d'argent avant visite et signature du bail.",
        ],
        "medium": [
            "Demandez une visite vidéo en direct et des documents officiels.",
            "Comparez le loyer aux références du quartier.",
            "Évitez tout paiement avant signature.",
        ],
        "high": [
            "Considérez cette annonce comme à haut risque jusqu'à preuve contraire.",
            "Ne transférez aucun dépôt avant une visite en personne.",
            "Privilégiez les agences établies et refusez la pression.",
        ],
        "disclaimer": (
            "Un score de risque n'est pas une preuve de fraude. SwipeNest AI signale des "
            "indices pour vous aider à rester prudent — vérifiez toujours par vous-même."
        ),
    },
}


def assess_listing(listing: dict, lang: str = "en") -> ScamAssessment:
    refs = data_store.load_rent_refs()
    arr = str(listing["arrondissement"])
    ref_m2 = refs.get(arr, {}).get("eur_per_m2", 33)
    expected = ref_m2 * listing["surface_m2"]
    rent = listing["rent_eur"]
    ratio = rent / max(expected, 1)

    signals: list[dict[str, Any]] = []
    score = 0.0

    # Price vs local reference
    if ratio < 0.45:
        signals.append(
            {
                "code": "below_market",
                "severity": 0.4,
                "detail": f"Rent €{rent} is ~{ratio:.0%} of local reference (~€{int(expected)}).",
            }
        )
        score += 0.4
    elif ratio < 0.6:
        signals.append(
            {
                "code": "below_market",
                "severity": 0.22,
                "detail": f"Rent is noticeably below local reference (~€{int(expected)}/mo).",
            }
        )
        score += 0.22

    text = f"{listing.get('title', '')} {listing.get('description', '')}".lower()
    for pattern, code, weight in SUSPICIOUS_PATTERNS:
        if re.search(pattern, text):
            if not any(s["code"] == code for s in signals):
                signals.append({"code": code, "severity": weight, "detail": f"Detected pattern: {code.replace('_', ' ')}."})
                score += weight
            else:
                # reinforce
                score += weight * 0.35

    # Missing important details
    missing = []
    if not listing.get("description") or len(listing.get("description", "")) < 40:
        missing.append("short description")
    if listing.get("surface_m2", 0) < 10:
        missing.append("surface")
    if missing:
        signals.append(
            {
                "code": "missing_details",
                "severity": 0.12,
                "detail": f"Incomplete listing details: {', '.join(missing)}.",
            }
        )
        score += 0.12

    # Injected labels for synthetic scam tests (still recompute explainable score)
    if listing.get("is_scam_test") and listing.get("injected_scam_signals"):
        for code in listing["injected_scam_signals"]:
            if not any(s["code"] == code for s in signals):
                signals.append(
                    {
                        "code": code,
                        "severity": 0.15,
                        "detail": f"Synthetic test signal: {code.replace('_', ' ')}.",
                    }
                )
                score += 0.12

    score = float(min(1.0, score))
    if score >= 0.55:
        risk = "high"
    elif score >= 0.28:
        risk = "medium"
    else:
        risk = "low"

    pack = ADVICE["fr" if lang == "fr" else "en"]
    return ScamAssessment(
        listing_id=listing["id"],
        risk=risk,
        score=round(score, 3),
        signals=signals,
        advice=pack[risk],
        disclaimer=pack["disclaimer"],
    )
