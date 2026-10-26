"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { getMessages, t } from "@/lib/i18n";
import { saveProfileState } from "@/lib/supabase/profile";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAppStore } from "@/store/useAppStore";

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const preferences = useAppStore((s) => s.preferences);
  const setPreferences = useAppStore((s) => s.setPreferences);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const resetAll = useAppStore((s) => s.resetAll);
  const clearSessionState = useAppStore((s) => s.clearSessionState);
  const messages = getMessages(locale);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const prefs = { ...preferences, language: locale };
    await api.updatePreferences(prefs);
    if (user && isSupabaseConfigured()) {
      await saveProfileState({
        userId: user.id,
        preferences: prefs,
        onboardingComplete,
        email: user.email,
        displayName: user.user_metadata?.full_name || user.user_metadata?.name,
        avatarUrl: user.user_metadata?.avatar_url,
      }).catch(() => undefined);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const logout = async () => {
    await signOut();
    clearSessionState();
    router.push("/");
  };

  const reset = async () => {
    await resetAll();
    router.push("/");
  };

  return (
    <RequireAuth>
      <main className="page max-w-lg">
        <h1 className="text-xl font-bold text-[var(--sn-green)] lg:text-2xl">
          {t(messages, "settings.title")}
        </h1>

        <section className="sn-card mt-5 space-y-3 p-5">
          <h2 className="font-bold text-[var(--sn-green)]">{t(messages, "settings.account")}</h2>
          {user && (
            <>
              <p className="text-sm font-semibold text-[var(--sn-ink)]">{user.email}</p>
              <button type="button" className="sn-btn sn-btn-secondary w-full" onClick={logout}>
                {t(messages, "settings.signOut")}
              </button>
            </>
          )}
        </section>

        <section className="sn-card mt-4 space-y-4 p-5">
          <h2 className="font-bold text-[var(--sn-green)]">{t(messages, "settings.language")}</h2>
          <div className="flex gap-2">
            {(["en", "fr"] as const).map((lang) => (
              <button
                key={lang}
                className="sn-chip uppercase"
                data-active={locale === lang}
                onClick={() => setLocale(lang)}
              >
                {lang}
              </button>
            ))}
          </div>
        </section>

        <section className="sn-card mt-4 space-y-4 p-5">
          <h2 className="font-bold text-[var(--sn-green)]">{t(messages, "settings.preferences")}</h2>
          <label className="block text-sm text-[var(--sn-muted)]">
            {t(messages, "onboarding.budget")} — €{preferences.max_rent}
          </label>
          <input
            type="range"
            min={700}
            max={4500}
            step={50}
            value={preferences.max_rent}
            onChange={(e) => setPreferences({ max_rent: Number(e.target.value) })}
            className="w-full accent-[var(--sn-green)]"
          />
          <label className="block text-sm text-[var(--sn-muted)]">
            {t(messages, "onboarding.surface")} — {preferences.min_surface} m²
          </label>
          <input
            type="range"
            min={15}
            max={120}
            value={preferences.min_surface}
            onChange={(e) => setPreferences({ min_surface: Number(e.target.value) })}
            className="w-full accent-[var(--sn-green)]"
          />
          <input
            className="sn-input"
            value={preferences.name}
            onChange={(e) => setPreferences({ name: e.target.value })}
            placeholder={t(messages, "onboarding.name")}
          />
          <button className="sn-btn sn-btn-primary w-full" onClick={save}>
            {saved ? "✓" : t(messages, "settings.save")}
          </button>
        </section>

        <button className="sn-btn sn-btn-secondary mt-6 w-full" onClick={reset}>
          {t(messages, "settings.reset")}
        </button>
      </main>
    </RequireAuth>
  );
}
