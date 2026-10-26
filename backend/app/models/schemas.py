from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


RejectionReason = Literal[
    "too_expensive",
    "too_small",
    "too_dark",
    "wrong_neighborhood",
    "disliked_style",
    "missing_amenities",
    "other",
]


class UserPreferences(BaseModel):
    name: str = "Guest"
    max_rent: int = 1800
    min_surface: int = 25
    arrondissements: list[int] = Field(default_factory=lambda: [11, 10, 3, 18])
    apartment_types: list[str] = Field(default_factory=lambda: ["apartment", "studio"])
    furnished: Literal["any", "furnished", "unfurnished"] = "any"
    amenities: list[str] = Field(default_factory=list)
    lifestyle: list[str] = Field(default_factory=list)
    aesthetic: list[str] = Field(default_factory=list)
    dream_description: str = ""
    language: Literal["en", "fr"] = "en"
    occupation: str = ""
    about: str = ""


class OnboardingRequest(BaseModel):
    preferences: UserPreferences
    demo_profile: bool = False


class SwipeRequest(BaseModel):
    listing_id: str
    action: Literal["like", "reject"]
    reason: RejectionReason | None = None
    reason_note: str | None = None


class UndoRequest(BaseModel):
    pass


class SearchRequest(BaseModel):
    query: str
    refine: str | None = None
    limit: int = 20


class CompareRequest(BaseModel):
    listing_ids: list[str]


class ApplicationRequest(BaseModel):
    listing_id: str
    tone: Literal["professional", "warm", "concise"] = "professional"
    language: Literal["en", "fr"] = "fr"


class ListingOut(BaseModel):
    id: str
    title: str
    description: str
    rent_eur: int
    surface_m2: int
    rooms: int
    bedrooms: int
    floor: int
    arrondissement: int
    neighborhood: str
    city: str
    lat: float
    lng: float
    style: str
    condition: str
    vibe: str
    property_type: str
    furnished: bool
    amenities: list[str]
    tags: list[str]
    image: str
    brightness: float
    warmth: float
    is_synthetic: bool
    is_scam_test: bool
    match_score: float | None = None
    scam_risk: Literal["low", "medium", "high"] | None = None
    scam_score: float | None = None


class ExplanationFactor(BaseModel):
    key: str
    label: str
    positive: bool
    weight: float
    detail: str


class ExplanationOut(BaseModel):
    listing_id: str
    match_score: float
    summary: str
    factors: list[ExplanationFactor]
    compromises: list[str]


class TasteDNAOut(BaseModel):
    dimensions: dict[str, float]
    insights: list[str]
    style_affinity: dict[str, float]
    neighborhood_affinity: dict[str, float]
    amenity_affinity: dict[str, float]
    interaction_count: int
    likes: int
    rejects: int


class ScamAssessment(BaseModel):
    listing_id: str
    risk: Literal["low", "medium", "high"]
    score: float
    signals: list[dict[str, Any]]
    advice: list[str]
    disclaimer: str


class ApplicationOut(BaseModel):
    listing_id: str
    message: str
    tone: str
    language: str
    checklist: list[str]
    notes: list[str]


class UserStateOut(BaseModel):
    preferences: UserPreferences
    swipe_count: int
    likes: list[str]
    rejects: list[str]
    favorites: list[str]
    last_swipe_id: str | None
    onboarding_complete: bool
