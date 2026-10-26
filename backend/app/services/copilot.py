from __future__ import annotations

from app.config import settings
from app.models.schemas import ApplicationOut, UserPreferences


CHECKLIST = {
    "en": [
        "Valid ID / passport",
        "Proof of address",
        "Last 3 pay slips (or equivalent income proof)",
        "Employment contract or student certificate",
        "Last tax notice (avis d'imposition)",
        "Guarantor documents (if applicable)",
        "RIB (bank details)",
    ],
    "fr": [
        "Pièce d'identité valide",
        "Justificatif de domicile",
        "3 derniers bulletins de salaire",
        "Contrat de travail ou certificat de scolarité",
        "Dernier avis d'imposition",
        "Dossier garant (si applicable)",
        "RIB",
    ],
}

NOTES = {
    "en": [
        "SwipeNest never invents income, employment or guarantor details.",
        "Edit the message before sending — you stay in control.",
        "No application is sent automatically.",
    ],
    "fr": [
        "SwipeNest n'invente jamais revenus, emploi ou garant.",
        "Modifiez le message avant envoi — vous gardez le contrôle.",
        "Aucune candidature n'est envoyée automatiquement.",
    ],
}


def _template_message(
    listing: dict,
    prefs: UserPreferences,
    tone: str,
    lang: str,
) -> str:
    name = prefs.name or ("Candidate" if lang == "en" else "Candidat")
    occupation = prefs.occupation.strip()
    about = prefs.about.strip()
    room_fr = "pièce" if listing["rooms"] == 1 else "pièces"
    room_en = "room" if listing["rooms"] == 1 else "rooms"
    apt = (
        f"{listing['rooms']} {room_fr} · {listing['surface_m2']} m² · "
        f"Paris {listing['arrondissement']}e ({listing['neighborhood']}) · "
        f"{listing['rent_eur']} €/mois"
    )
    apt_en = (
        f"{listing['rooms']} {room_en} · {listing['surface_m2']} m² · "
        f"Paris {listing['arrondissement']} ({listing['neighborhood']}) · "
        f"€{listing['rent_eur']}/month"
    )
    occ_fr = f"Je suis {occupation}. " if occupation else ""
    occ_en = f"I work as {occupation}. " if occupation else ""
    about_fr = f"{about} " if about else ""
    about_en = f"{about} " if about else ""

    if lang == "fr":
        if tone == "warm":
            return (
                f"Bonjour,\n\n"
                f"Je m'appelle {name} et votre appartement ({apt}) a particulièrement retenu mon attention. "
                f"{occ_fr}{about_fr}"
                f"Je recherche un logement soigné, et celui-ci correspond vraiment à ce que je souhaite. "
                f"Seriez-vous disponible pour une visite dans les prochains jours ?\n\n"
                f"Je peux vous transmettre mon dossier complet sur demande.\n\n"
                f"Bien cordialement,\n{name}"
            )
        if tone == "concise":
            return (
                f"Bonjour,\n\n"
                f"Je suis {name}. {occ_fr}"
                f"Je suis très intéressé(e) par votre bien ({apt}). "
                f"Serait-il possible d'organiser une visite ? Dossier prêt.\n\n"
                f"Cordialement,\n{name}"
            )
        return (
            f"Madame, Monsieur,\n\n"
            f"Je me permets de vous contacter concernant la location de votre appartement "
            f"situé à Paris {listing['arrondissement']}e ({listing['surface_m2']} m², "
            f"{listing['rooms']} {room_fr}, {listing['rent_eur']} €/mois).\n\n"
            f"Je m'appelle {name}. {occ_fr}{about_fr}"
            f"Mon projet locatif est sérieux et mon dossier est prêt. "
            f"Je serais ravi(e) de convenir d'un rendez-vous pour une visite.\n\n"
            f"Dans l'attente de votre retour, je vous prie d'agréer mes salutations distinguées.\n\n"
            f"{name}"
        )

    if tone == "warm":
        return (
            f"Hello,\n\n"
            f"My name is {name}, and your apartment ({apt_en}) really caught my eye. "
            f"{occ_en}{about_en}"
            f"I'm looking for a carefully kept home, and this one feels like a strong match. "
            f"Would you be available for a viewing in the coming days?\n\n"
            f"I can share my full application file on request.\n\n"
            f"Warm regards,\n{name}"
        )
    if tone == "concise":
        return (
            f"Hello,\n\n"
            f"I'm {name}. {occ_en}"
            f"I'm very interested in your listing ({apt_en}). "
            f"Could we schedule a viewing? Application file ready.\n\n"
            f"Best regards,\n{name}"
        )
    return (
        f"Dear Landlord,\n\n"
        f"I am writing to express my interest in renting your apartment in "
        f"Paris {listing['arrondissement']} ({listing['surface_m2']} m², "
        f"{listing['rooms']} {room_en}, €{listing['rent_eur']}/month).\n\n"
        f"My name is {name}. {occ_en}{about_en}"
        f"I am a serious applicant with a complete file ready to share. "
        f"I would appreciate the opportunity to schedule a viewing.\n\n"
        f"Kind regards,\n{name}"
    )


def _gemini_message(
    listing: dict,
    prefs: UserPreferences,
    tone: str,
    lang: str,
) -> str | None:
    api_key = settings.gemini_api_key
    if not api_key:
        return None
    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(settings.gemini_model)
        language = "French" if lang == "fr" else "English"
        prompt = f"""You write rental application messages for Paris apartments.
Use ONLY the provided user profile and listing facts.
Never invent income, employer, guarantor, salary, or documents.
Do not claim the user already visited the apartment.
Language: {language}. Tone: {tone}.
Return only the message body, no markdown fences.

User:
- name: {prefs.name or 'Candidate'}
- occupation: {prefs.occupation or '(not provided)'}
- about: {prefs.about or '(not provided)'}

Listing:
- title: {listing.get('title')}
- arrondissement: Paris {listing.get('arrondissement')}e ({listing.get('neighborhood')})
- surface: {listing.get('surface_m2')} m²
- rooms: {listing.get('rooms')}
- rent: {listing.get('rent_eur')} EUR/month
- style: {listing.get('style')}
- furnished: {listing.get('furnished')}
"""
        response = model.generate_content(prompt)
        text = (response.text or "").strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("text"):
                text = text[4:].strip()
        return text or None
    except Exception as exc:
        print(f"[copilot] Gemini fallback: {exc}")
        return None


def generate_application(
    listing: dict,
    prefs: UserPreferences,
    tone: str = "professional",
    language: str = "fr",
) -> ApplicationOut:
    lang = "fr" if language == "fr" else "en"
    message = _gemini_message(listing, prefs, tone, lang)
    used_gemini = message is not None
    if not message:
        message = _template_message(listing, prefs, tone, lang)

    notes = list(NOTES[lang])
    if used_gemini:
        notes = (
            ["Draft generated with Gemini — review before sending."]
            if lang == "en"
            else ["Brouillon généré avec Gemini — relisez avant envoi."]
        ) + notes
    else:
        notes = (
            ["Template mode (no Gemini key / Gemini unavailable)."]
            if lang == "en"
            else ["Mode modèle (pas de clé Gemini / Gemini indisponible)."]
        ) + notes

    return ApplicationOut(
        listing_id=listing["id"],
        message=message.strip(),
        tone=tone,
        language=lang,
        checklist=CHECKLIST[lang],
        notes=notes,
    )
