export type RejectionReason =
  | "too_expensive"
  | "too_small"
  | "too_dark"
  | "wrong_neighborhood"
  | "disliked_style"
  | "missing_amenities"
  | "other";

export interface UserPreferences {
  name: string;
  max_rent: number;
  min_surface: number;
  arrondissements: number[];
  apartment_types: string[];
  furnished: "any" | "furnished" | "unfurnished";
  amenities: string[];
  lifestyle: string[];
  aesthetic: string[];
  dream_description: string;
  language: "en" | "fr";
  occupation: string;
  about: string;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  rent_eur: number;
  surface_m2: number;
  rooms: number;
  bedrooms: number;
  floor: number;
  arrondissement: number;
  neighborhood: string;
  city: string;
  lat: number;
  lng: number;
  style: string;
  condition: string;
  vibe: string;
  property_type: string;
  furnished: boolean;
  amenities: string[];
  tags: string[];
  image: string;
  brightness: number;
  warmth: number;
  is_synthetic: boolean;
  is_scam_test: boolean;
  match_score?: number;
  scam_risk?: "low" | "medium" | "high";
  scam_score?: number;
}

export interface UserState {
  preferences: UserPreferences;
  swipe_count: number;
  likes: string[];
  rejects: string[];
  favorites: string[];
  last_swipe_id: string | null;
  onboarding_complete: boolean;
}

export interface TasteDNA {
  dimensions: Record<string, number>;
  insights: string[];
  style_affinity: Record<string, number>;
  neighborhood_affinity: Record<string, number>;
  amenity_affinity: Record<string, number>;
  interaction_count: number;
  likes: number;
  rejects: number;
}

export interface Explanation {
  listing_id: string;
  match_score: number;
  summary: string;
  factors: {
    key: string;
    label: string;
    positive: boolean;
    weight: number;
    detail: string;
  }[];
  compromises: string[];
}

export interface ScamAssessment {
  listing_id: string;
  risk: "low" | "medium" | "high";
  score: number;
  signals: { code: string; severity: number; detail: string }[];
  advice: string[];
  disclaimer: string;
}

export interface ApplicationDraft {
  listing_id: string;
  message: string;
  tone: string;
  language: string;
  checklist: string[];
  notes: string[];
}
