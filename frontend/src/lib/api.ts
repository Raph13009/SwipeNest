import type {
  ApplicationDraft,
  Explanation,
  Listing,
  RejectionReason,
  ScamAssessment,
  TasteDNA,
  UserPreferences,
  UserState,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

let apiUserId = "default";

export function setApiUserId(userId: string | null | undefined) {
  apiUserId = userId?.trim() || "default";
}

export function getApiUserId() {
  return apiUserId;
}

function withUser(path: string) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}user_id=${encodeURIComponent(apiUserId)}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${withUser(path)}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function mediaUrl(path: string) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

export const api = {
  health: () => request<{ status: string; data_ready: boolean }>("/api/health"),
  getUser: () => request<UserState>("/api/user"),
  onboarding: (preferences: UserPreferences, demo_profile = false) =>
    request<{ ok: boolean; state: UserState }>("/api/onboarding", {
      method: "POST",
      body: JSON.stringify({ preferences, demo_profile }),
    }),
  updatePreferences: (preferences: UserPreferences) =>
    request<UserState>("/api/user/preferences", {
      method: "PUT",
      body: JSON.stringify(preferences),
    }),
  resetUser: () => request<UserState>("/api/user/reset", { method: "POST" }),
  feed: (limit = 25) => request<{ items: Listing[] }>(`/api/feed?limit=${limit}`),
  listing: (id: string) => request<Listing>(`/api/listings/${id}`),
  swipe: (listing_id: string, action: "like" | "reject", reason?: RejectionReason) =>
    request<{ ok: boolean; state: UserState; taste_dna: TasteDNA }>("/api/swipe", {
      method: "POST",
      body: JSON.stringify({ listing_id, action, reason: reason || null }),
    }),
  undo: () => request<{ ok: boolean; state: UserState }>("/api/swipe/undo", { method: "POST" }),
  favorites: () => request<{ items: Listing[] }>("/api/favorites"),
  removeFavorite: (id: string) =>
    request<{ favorites: string[] }>(`/api/favorites/${id}`, { method: "DELETE" }),
  explain: (id: string) => request<Explanation>(`/api/explain/${id}`),
  tasteDna: () => request<TasteDNA>("/api/taste-dna"),
  resetDna: () => request<TasteDNA>("/api/taste-dna/reset", { method: "POST" }),
  search: (query: string, refine?: string) =>
    request<{ items: Listing[]; query: string }>("/api/search", {
      method: "POST",
      body: JSON.stringify({ query, refine: refine || null, limit: 24 }),
    }),
  scam: (id: string) => request<ScamAssessment>(`/api/scam/${id}`),
  apply: (listing_id: string, tone: string, language: string) =>
    request<ApplicationDraft>("/api/apply", {
      method: "POST",
      body: JSON.stringify({ listing_id, tone, language }),
    }),
  compare: (listing_ids: string[]) =>
    request<{
      items: Array<Record<string, unknown>>;
      insights: string[];
      winner_id: string;
    }>("/api/compare", {
      method: "POST",
      body: JSON.stringify({ listing_ids }),
    }),
  map: () =>
    request<{
      points: Array<{
        id: string;
        lat: number;
        lng: number;
        rent_eur: number;
        title: string;
        image: string;
        arrondissement: number;
        match_score: number;
        scam_risk: string;
      }>;
    }>("/api/map"),
  adaptation: () =>
    request<{
      top: Array<{ id: string; match_score: number; title: string }>;
      weights: Record<string, number>;
      biases: Record<string, number>;
      interaction_count: number;
    }>("/api/demo/adaptation"),
};
