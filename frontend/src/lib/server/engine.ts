import { readFileSync, existsSync } from "fs";
import path from "path";
import type {
  Explanation,
  Listing,
  RejectionReason,
  ScamAssessment,
  TasteDNA,
  UserPreferences,
  UserState,
} from "@/lib/types";

type RawListing = Listing & { image_file?: string };

type UserModel = {
  preferences: UserPreferences;
  like_ids: string[];
  reject_ids: string[];
  favorites: string[];
  reject_reasons: Record<string, RejectionReason>;
  last_swipe_id: string | null;
  last_swipe_action: string | null;
  onboarding_complete: boolean;
  dim_scores: Record<string, number>;
  style_scores: Record<string, number>;
  neighborhood_scores: Record<string, number>;
  amenity_scores: Record<string, number>;
};

const defaultPrefs = (): UserPreferences => ({
  name: "",
  max_rent: 1800,
  min_surface: 25,
  arrondissements: [],
  apartment_types: ["apartment", "studio"],
  furnished: "any",
  amenities: [],
  lifestyle: [],
  aesthetic: [],
  dream_description: "",
  language: "en",
  occupation: "",
  about: "",
});

function dataRoot() {
  const candidates = [
    path.join(process.cwd(), "data"),
    path.join(process.cwd(), "..", "data"),
    path.join(process.cwd(), "frontend", "data"),
  ];
  for (const c of candidates) {
    if (existsSync(path.join(c, "processed", "listings.json"))) return c;
  }
  return path.join(process.cwd(), "..", "data");
}

const g = globalThis as unknown as {
  __snListings?: RawListing[];
  __snUsers?: Map<string, UserModel>;
  __snRentRefs?: Record<string, { eur_per_m2?: number }>;
};

function listings(): RawListing[] {
  if (!g.__snListings) {
    const file = path.join(dataRoot(), "processed", "listings.json");
    g.__snListings = JSON.parse(readFileSync(file, "utf8")) as RawListing[];
  }
  return g.__snListings;
}

function rentRefs() {
  if (!g.__snRentRefs) {
    const file = path.join(dataRoot(), "processed", "rent_references.json");
    g.__snRentRefs = existsSync(file)
      ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, { eur_per_m2?: number }>)
      : {};
  }
  return g.__snRentRefs;
}

function users() {
  if (!g.__snUsers) g.__snUsers = new Map();
  return g.__snUsers;
}

function getUser(userId: string): UserModel {
  const map = users();
  let user = map.get(userId);
  if (!user) {
    user = {
      preferences: defaultPrefs(),
      like_ids: [],
      reject_ids: [],
      favorites: [],
      reject_reasons: {},
      last_swipe_id: null,
      last_swipe_action: null,
      onboarding_complete: false,
      dim_scores: {
        interior_design: 0.5,
        natural_light: 0.5,
        architecture: 0.5,
        apartment_size: 0.5,
        neighborhoods: 0.5,
        layout: 0.5,
        materials_finishes: 0.5,
        amenities: 0.5,
      },
      style_scores: {},
      neighborhood_scores: {},
      amenity_scores: {},
    };
    map.set(userId, user);
  }
  return user;
}

function scoreListing(listing: RawListing, user: UserModel): number {
  const prefs = user.preferences;
  let score = 55;
  if (listing.rent_eur <= prefs.max_rent) score += 12;
  else score -= Math.min(25, ((listing.rent_eur - prefs.max_rent) / prefs.max_rent) * 40);
  if (listing.surface_m2 >= prefs.min_surface) score += 10;
  else score -= 8;
  if (!prefs.arrondissements.length || prefs.arrondissements.includes(listing.arrondissement)) {
    score += 10;
  } else {
    score -= 12;
  }
  for (const a of prefs.amenities) {
    if (listing.amenities?.includes(a)) score += 2;
  }
  for (const a of prefs.aesthetic) {
    if (
      listing.style?.toLowerCase().includes(a.toLowerCase()) ||
      listing.tags?.some((t) => t.toLowerCase().includes(a.toLowerCase()))
    ) {
      score += 3;
    }
  }
  if (listing.brightness >= 0.55) score += 4;
  if (user.like_ids.includes(listing.id) || user.reject_ids.includes(listing.id)) score = 0;
  return Math.max(0, Math.min(99, Math.round(score)));
}

function assessScam(listing: RawListing, lang: "en" | "fr"): ScamAssessment {
  const refs = rentRefs();
  const refM2 = refs[String(listing.arrondissement)]?.eur_per_m2 ?? 33;
  const expected = refM2 * listing.surface_m2;
  const ratio = listing.rent_eur / Math.max(expected, 1);
  const signals: ScamAssessment["signals"] = [];
  let score = 0;
  if (ratio < 0.45) {
    signals.push({
      code: "below_market",
      severity: 0.4,
      detail: `Rent €${listing.rent_eur} is ~${Math.round(ratio * 100)}% of local reference.`,
    });
    score += 0.4;
  }
  if (listing.is_scam_test) {
    signals.push({ code: "synthetic_scam", severity: 0.5, detail: "Flagged demo scam listing." });
    score += 0.5;
  }
  const text = `${listing.title} ${listing.description}`.toLowerCase();
  if (/western union|wire transfer|whatsapp only|no viewing|urgent|act fast/.test(text)) {
    signals.push({ code: "suspicious_wording", severity: 0.25, detail: "Suspicious wording detected." });
    score += 0.25;
  }
  const risk = score >= 0.55 ? "high" : score >= 0.25 ? "medium" : "low";
  const advice =
    lang === "fr"
      ? [
          "Vérifiez le propriétaire et visitez sur place.",
          "Ne versez jamais d'argent avant signature du bail.",
        ]
      : [
          "Verify the landlord and visit in person.",
          "Never send money before signing a lease.",
        ];
  return {
    listing_id: listing.id,
    risk,
    score: Math.round(score * 100) / 100,
    signals,
    advice,
    disclaimer:
      lang === "fr"
        ? "Un score de risque n'est pas une preuve de fraude."
        : "A risk score is not proof of fraud.",
  };
}

function enrich(listing: RawListing, userId: string): Listing {
  const user = getUser(userId);
  const scam = assessScam(listing, user.preferences.language);
  const { image_file: _f, ...rest } = listing;
  return {
    ...rest,
    image: `/api/images/${listing.image_file || listing.id + ".jpg"}`,
    match_score: scoreListing(listing, user),
    scam_risk: scam.risk,
    scam_score: scam.score,
  };
}

function stateOf(userId: string): UserState {
  const user = getUser(userId);
  return {
    preferences: user.preferences,
    swipe_count: user.like_ids.length + user.reject_ids.length,
    likes: user.like_ids,
    rejects: user.reject_ids,
    favorites: user.favorites,
    last_swipe_id: user.last_swipe_id,
    onboarding_complete: user.onboarding_complete,
  };
}

export function imagePath(filename: string) {
  const safe = path.basename(filename);
  return path.join(dataRoot(), "images", safe);
}

export const engine = {
  health() {
    return {
      status: "ok",
      data_ready: listings().length > 0,
      app: "SwipeNest AI",
      runtime: "next",
    };
  },

  onboarding(userId: string, preferences: UserPreferences, demo = false) {
    const user = getUser(userId);
    if (demo) {
      user.preferences = {
        ...defaultPrefs(),
        name: "Camille",
        max_rent: 1600,
        min_surface: 30,
        arrondissements: [11, 10, 3, 4, 18],
        amenities: ["balcony", "hardwood_floors", "elevator"],
        lifestyle: ["walkable", "cafes", "parks"],
        aesthetic: ["bright", "haussmannian", "parquet"],
        dream_description:
          "Bright Haussmannian apartment with wooden floors, near lively cafés, under €1,600.",
        language: preferences.language,
        occupation: "Product designer",
        about: "Looking for a calm, light-filled home in central-east Paris.",
      };
    } else {
      user.preferences = preferences;
    }
    user.onboarding_complete = true;
    if (user.preferences.min_surface >= 40) user.dim_scores.apartment_size = 0.65;
    if (user.preferences.aesthetic.some((a) => /bright|lumineux/i.test(a))) {
      user.dim_scores.natural_light = 0.7;
    }
    for (const a of user.preferences.arrondissements) {
      user.neighborhood_scores[String(a)] = 0.7;
    }
    return { ok: true, state: stateOf(userId) };
  },

  getUser: stateOf,

  updatePreferences(userId: string, preferences: UserPreferences) {
    const user = getUser(userId);
    user.preferences = preferences;
    user.onboarding_complete = true;
    return stateOf(userId);
  },

  resetUser(userId: string) {
    users().delete(userId);
    return stateOf(userId);
  },

  feed(userId: string, limit = 25) {
    const user = getUser(userId);
    const ranked = listings()
      .map((l) => enrich(l, userId))
      .filter((l) => !user.like_ids.includes(l.id) && !user.reject_ids.includes(l.id))
      .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
      .slice(0, limit);
    return { items: ranked };
  },

  listing(userId: string, id: string) {
    const raw = listings().find((l) => l.id === id);
    if (!raw) return null;
    return enrich(raw, userId);
  },

  listings(userId: string, opts: { arrondissement?: number; max_rent?: number; limit?: number }) {
    const items: Listing[] = [];
    for (const l of listings()) {
      if (opts.arrondissement && l.arrondissement !== opts.arrondissement) continue;
      if (opts.max_rent && l.rent_eur > opts.max_rent) continue;
      items.push(enrich(l, userId));
      if (items.length >= (opts.limit || 100)) break;
    }
    return { items };
  },

  swipe(userId: string, listingId: string, action: "like" | "reject", reason?: RejectionReason | null) {
    const user = getUser(userId);
    if (!listings().some((l) => l.id === listingId)) throw new Error("Listing not found");
    user.last_swipe_id = listingId;
    user.last_swipe_action = action;
    if (action === "like") {
      if (!user.like_ids.includes(listingId)) user.like_ids.push(listingId);
      if (!user.favorites.includes(listingId)) user.favorites.push(listingId);
    } else {
      if (!user.reject_ids.includes(listingId)) user.reject_ids.push(listingId);
      if (reason) user.reject_reasons[listingId] = reason;
    }
    return {
      ok: true,
      state: stateOf(userId),
      taste_dna: this.tasteDna(userId),
    };
  },

  undo(userId: string) {
    const user = getUser(userId);
    const id = user.last_swipe_id;
    if (id) {
      user.like_ids = user.like_ids.filter((x) => x !== id);
      user.reject_ids = user.reject_ids.filter((x) => x !== id);
      user.favorites = user.favorites.filter((x) => x !== id);
      delete user.reject_reasons[id];
    }
    user.last_swipe_id = null;
    user.last_swipe_action = null;
    return { ok: true, state: stateOf(userId) };
  },

  addFavorite(userId: string, listingId: string) {
    const user = getUser(userId);
    if (!listings().some((l) => l.id === listingId)) throw new Error("Listing not found");
    if (!user.favorites.includes(listingId)) user.favorites.push(listingId);
    return { favorites: user.favorites };
  },

  removeFavorite(userId: string, listingId: string) {
    const user = getUser(userId);
    user.favorites = user.favorites.filter((x) => x !== listingId);
    return { favorites: user.favorites };
  },

  favorites(userId: string) {
    const user = getUser(userId);
    return {
      items: user.favorites
        .map((id) => this.listing(userId, id))
        .filter(Boolean) as Listing[],
    };
  },

  explain(userId: string, listingId: string): Explanation {
    const listing = this.listing(userId, listingId);
    if (!listing) throw new Error("Listing not found");
    const user = getUser(userId);
    const fr = user.preferences.language === "fr";
    const factors = [
      {
        key: "budget",
        label: fr ? "Budget" : "Budget",
        positive: listing.rent_eur <= user.preferences.max_rent,
        weight: 0.3,
        detail: `€${listing.rent_eur} / max €${user.preferences.max_rent}`,
      },
      {
        key: "surface",
        label: fr ? "Surface" : "Size",
        positive: listing.surface_m2 >= user.preferences.min_surface,
        weight: 0.25,
        detail: `${listing.surface_m2} m²`,
      },
      {
        key: "location",
        label: fr ? "Quartier" : "Neighborhood",
        positive:
          !user.preferences.arrondissements.length ||
          user.preferences.arrondissements.includes(listing.arrondissement),
        weight: 0.25,
        detail: `${listing.arrondissement}e — ${listing.neighborhood}`,
      },
    ];
    return {
      listing_id: listingId,
      match_score: listing.match_score || 0,
      summary: fr
        ? `Match ${listing.match_score}% selon ton profil.`
        : `${listing.match_score}% match based on your profile.`,
      factors,
      compromises: [],
    };
  },

  tasteDna(userId: string): TasteDNA {
    const user = getUser(userId);
    const fr = user.preferences.language === "fr";
    return {
      dimensions: user.dim_scores,
      insights: [
        fr
          ? `Budget cible autour de €${user.preferences.max_rent}.`
          : `Target budget around €${user.preferences.max_rent}.`,
        fr
          ? `${user.like_ids.length} likes · ${user.reject_ids.length} rejects`
          : `${user.like_ids.length} likes · ${user.reject_ids.length} rejects`,
      ],
      style_affinity: user.style_scores,
      neighborhood_affinity: user.neighborhood_scores,
      amenity_affinity: user.amenity_scores,
      interaction_count: user.like_ids.length + user.reject_ids.length,
      likes: user.like_ids.length,
      rejects: user.reject_ids.length,
    };
  },

  resetDna(userId: string) {
    const user = getUser(userId);
    const prefs = user.preferences;
    const onboarding = user.onboarding_complete;
    users().delete(userId);
    const fresh = getUser(userId);
    fresh.preferences = prefs;
    fresh.onboarding_complete = onboarding;
    return this.tasteDna(userId);
  },

  search(userId: string, query: string, limit = 24) {
    const q = query.toLowerCase();
    const items = listings()
      .filter((l) =>
        `${l.title} ${l.description} ${l.neighborhood} ${l.style} ${l.tags?.join(" ")}`
          .toLowerCase()
          .includes(q)
      )
      .map((l) => enrich(l, userId))
      .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
      .slice(0, limit);
    return { items, query };
  },

  scam(userId: string, listingId: string) {
    const raw = listings().find((l) => l.id === listingId);
    if (!raw) throw new Error("Listing not found");
    return assessScam(raw, getUser(userId).preferences.language);
  },

  apply(userId: string, listingId: string, tone: string, language: string) {
    const listing = this.listing(userId, listingId);
    if (!listing) throw new Error("Listing not found");
    const user = getUser(userId);
    const fr = language === "fr";
    const message = fr
      ? `Bonjour,\n\nJe m'appelle ${user.preferences.name || "…"} et je suis très intéressé(e) par votre annonce « ${listing.title} » (${listing.surface_m2} m², ${listing.arrondissement}e). ${user.preferences.about || ""}\n\nSerait-il possible de convenir d'une visite ?\n\nBien cordialement,\n${user.preferences.name || ""}`
      : `Hello,\n\nMy name is ${user.preferences.name || "…"} and I'm very interested in your listing “${listing.title}” (${listing.surface_m2} m², ${listing.arrondissement}th). ${user.preferences.about || ""}\n\nWould it be possible to schedule a viewing?\n\nBest regards,\n${user.preferences.name || ""}`;
    return {
      listing_id: listingId,
      message,
      tone,
      language,
      checklist: fr
        ? ["Personnalise le message", "Propose 2 créneaux de visite"]
        : ["Personalize the message", "Suggest 2 viewing slots"],
      notes: [],
    };
  },

  compare(userId: string, listingIds: string[]) {
    const items = listingIds
      .map((id) => this.listing(userId, id))
      .filter(Boolean) as Listing[];
    const winner = [...items].sort((a, b) => (b.match_score || 0) - (a.match_score || 0))[0];
    return {
      items,
      insights: items.map((i) => `${i.title}: ${i.match_score}%`),
      winner_id: winner?.id || "",
    };
  },

  map(userId: string) {
    return {
      points: listings()
        .slice(0, 200)
        .map((l) => {
          const e = enrich(l, userId);
          return {
            id: e.id,
            lat: e.lat,
            lng: e.lng,
            rent_eur: e.rent_eur,
            title: e.title,
            image: e.image,
            arrondissement: e.arrondissement,
            match_score: e.match_score || 0,
            scam_risk: e.scam_risk || "low",
          };
        }),
    };
  },

  adaptation(userId: string) {
    const dna = this.tasteDna(userId);
    return {
      top: this.feed(userId, 5).items.map((i) => ({
        id: i.id,
        match_score: i.match_score || 0,
        title: i.title,
      })),
      weights: {},
      biases: {},
      interaction_count: dna.interaction_count,
    };
  },
};
