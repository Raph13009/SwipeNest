"use client";

import { create } from "zustand";
import { api, getApiUserId } from "@/lib/api";
import type { Listing, TasteDNA, UserPreferences, UserState } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { fetchProfile, saveProfileState } from "@/lib/supabase/profile";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export const defaultPrefs: UserPreferences = {
  name: "",
  max_rent: 1800,
  min_surface: 25,
  arrondissements: [11, 10, 3],
  apartment_types: ["apartment", "studio"],
  furnished: "any",
  amenities: [],
  lifestyle: [],
  aesthetic: [],
  dream_description: "",
  language: "en",
  occupation: "",
  about: "",
};

/** Wipe legacy localStorage account cache from earlier demos. */
export function clearLegacyAccountCache() {
  try {
    localStorage.removeItem("swipenest-ui");
  } catch {
    /* ignore */
  }
}

async function persistProfile(prefs: UserPreferences, onboardingComplete: boolean) {
  if (!isSupabaseConfigured()) return;
  const userId = getApiUserId();
  if (!userId || userId === "default") return;
  await saveProfileState({
    userId,
    preferences: prefs,
    onboardingComplete,
  });
}

interface AppState {
  locale: Locale;
  hydrated: boolean;
  onboardingComplete: boolean;
  preferences: UserPreferences;
  user: UserState | null;
  feed: Listing[];
  tasteDna: TasteDNA | null;
  setLocale: (locale: Locale) => void;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  bootstrap: (authUserId?: string | null) => Promise<void>;
  completeOnboarding: (prefs: UserPreferences, demo?: boolean) => Promise<void>;
  refreshFeed: () => Promise<void>;
  refreshDna: () => Promise<void>;
  syncUser: () => Promise<void>;
  resetAll: () => Promise<void>;
  clearSessionState: () => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  locale: "en",
  hydrated: false,
  onboardingComplete: false,
  preferences: defaultPrefs,
  user: null,
  feed: [],
  tasteDna: null,

  setLocale: (locale) => {
    set({ locale });
    const prefs = { ...get().preferences, language: locale };
    set({ preferences: prefs });
    if (getApiUserId() !== "default") {
      api.updatePreferences(prefs).catch(() => undefined);
      void persistProfile(prefs, get().onboardingComplete).catch(() => undefined);
    }
  },

  setPreferences: (partial) =>
    set({ preferences: { ...get().preferences, ...partial } }),

  bootstrap: async (authUserId) => {
    clearLegacyAccountCache();

    if (!authUserId || !isSupabaseConfigured()) {
      set({
        hydrated: true,
        onboardingComplete: false,
        preferences: { ...defaultPrefs, language: get().locale },
        user: null,
        feed: [],
        tasteDna: null,
      });
      return;
    }

    try {
      const profile = await fetchProfile(authUserId);
      const prefs: UserPreferences = {
        ...defaultPrefs,
        ...((profile?.preferences as UserPreferences) || {}),
        language: ((profile?.preferences as UserPreferences)?.language ||
          get().locale) as Locale,
      };
      const complete = Boolean(profile?.onboarding_complete);

      let user = await api.getUser();
      if (complete && !user.onboarding_complete) {
        const res = await api.onboarding(prefs, false);
        user = res.state;
      }

      set({
        user,
        preferences: complete ? user.preferences : prefs,
        onboardingComplete: complete || user.onboarding_complete,
        locale: (user.preferences.language || prefs.language || get().locale) as Locale,
        hydrated: true,
      });

      if (complete || user.onboarding_complete) {
        await get().refreshFeed();
        await get().refreshDna();
      }
    } catch {
      set({
        hydrated: true,
        onboardingComplete: false,
        preferences: { ...defaultPrefs, language: get().locale },
      });
    }
  },

  completeOnboarding: async (prefs, demo = false) => {
    if (getApiUserId() === "default") {
      throw new Error("Sign in required");
    }
    const locale = get().locale;
    const payload = { ...prefs, language: locale };
    set({ preferences: payload, onboardingComplete: true });
    const res = await api.onboarding(payload, demo);
    set({
      user: res.state,
      preferences: res.state.preferences,
      onboardingComplete: true,
    });
    await persistProfile(res.state.preferences, true);
    void get().refreshFeed().catch(() => undefined);
    void get().refreshDna().catch(() => undefined);
  },

  refreshFeed: async () => {
    const { items } = await api.feed(30);
    set({ feed: items });
  },

  refreshDna: async () => {
    const dna = await api.tasteDna();
    set({ tasteDna: dna });
  },

  syncUser: async () => {
    const user = await api.getUser();
    set({
      user,
      preferences: user.preferences,
      onboardingComplete: user.onboarding_complete,
    });
  },

  resetAll: async () => {
    if (getApiUserId() !== "default") {
      await api.resetUser();
      const prefs = { ...defaultPrefs, language: get().locale };
      await persistProfile(prefs, false);
      set({
        onboardingComplete: false,
        user: null,
        feed: [],
        tasteDna: null,
        preferences: prefs,
      });
    } else {
      get().clearSessionState();
    }
  },

  clearSessionState: () => {
    clearLegacyAccountCache();
    set({
      onboardingComplete: false,
      user: null,
      feed: [],
      tasteDna: null,
      preferences: { ...defaultPrefs, language: get().locale },
      hydrated: true,
    });
  },
}));
