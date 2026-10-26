"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import { getMessages, t } from "@/lib/i18n";
import { saveProfileState } from "@/lib/supabase/profile";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAppStore } from "@/store/useAppStore";

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut, configured } = useAuth();
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const preferences = useAppStore((s) => s.preferences);
  const setPreferences = useAppStore((s) => s.setPreferences);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const resetAll = useAppStore((s) => s.resetAll);
  const clearSessionState = useAppStore((s) => s.clearSessionState);
  const messages = getMessages(locale);
  const [adaptation, setAdaptation] = useState<{
    top: Array<{ id: string; match_score: number; title: string }>;
    weights: Record<string, number>;
    biases: Record<string, number>;
    interaction_count: number;
  } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.adaptation().then(setAdaptation).catch(() => undefined);
  }, []);

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
    const a = await api.adaptation();
    setAdaptation(a);
  };

  const reset = async () => {
    await resetAll();
    router.push("/");
  };

  const logout = async () => {
    await signOut();
    clearSessionState();
    router.push("/");
  };

  return (
    <main className="page">
      <Logo />
      <h1 className="mt-6 text-3xl font-bold text-[var(--sn-green)]">{t(messages, "settings.title")}</h1>

      <section className="sn-card mt-6 space-y-3 p-5">
        <h2 className="font-bold text-[var(--sn-green)]">{t(messages, "settings.account")}</h2>
        {user ? (
          <>
            <div className="flex items-center gap-3">
              {user.user_metadata?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.user_metadata.avatar_url}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--sn-sage)]/40 text-sm font-bold text-[var(--sn-green)]">
                  {(user.email?.[0] || "?").toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-[var(--sn-ink)]">
                  {user.user_metadata?.full_name || user.user_metadata?.name || user.email}
                </p>
                <p className="text-xs text-[var(--sn-muted)]">{user.email}</p>
              </div>
            </div>
            <button type="button" className="sn-btn sn-btn-secondary w-full" onClick={logout}>
              {t(messages, "settings.signOut")}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--sn-muted)]">{t(messages, "settings.accountHint")}</p>
            <Link
              href="/login?next=/settings"
              className={`sn-btn sn-btn-primary w-full ${!configured ? "pointer-events-none opacity-60" : ""}`}
            >
              {t(messages, "settings.signIn")}
            </Link>
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
      </section>

      <section className="sn-card mt-4 space-y-3 p-5">
        <h2 className="font-bold text-[var(--sn-green)]">{t(messages, "settings.profile")}</h2>
        <input
          className="sn-input"
          value={preferences.name}
          onChange={(e) => setPreferences({ name: e.target.value })}
          placeholder={t(messages, "onboarding.name")}
        />
        <input
          className="sn-input"
          value={preferences.occupation}
          onChange={(e) => setPreferences({ occupation: e.target.value })}
          placeholder={t(messages, "settings.occupation")}
        />
        <textarea
          className="sn-textarea"
          value={preferences.about}
          onChange={(e) => setPreferences({ about: e.target.value })}
          placeholder={t(messages, "settings.about")}
        />
        <button className="sn-btn sn-btn-primary w-full" onClick={save}>
          {saved ? "✓" : t(messages, "settings.save")}
        </button>
      </section>

      {adaptation && (
        <section className="sn-card mt-4 p-5">
          <h2 className="font-bold text-[var(--sn-green)]">{t(messages, "settings.adaptation")}</h2>
          <p className="mt-1 text-sm text-[var(--sn-muted)]">
            {adaptation.interaction_count} interactions
          </p>
          <div className="mt-3 space-y-2 text-sm">
            {adaptation.top.map((item, i) => (
              <div key={item.id} className="flex justify-between rounded-xl bg-[var(--sn-beige)] px-3 py-2">
                <span>
                  #{i + 1} {item.title.slice(0, 36)}
                </span>
                <span className="font-bold text-[var(--sn-green)]">{item.match_score}%</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(adaptation.weights).map(([k, v]) => (
              <span key={k} className="sn-chip">
                {k}: {v.toFixed(2)}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="sn-card mt-4 p-5">
        <h2 className="font-bold text-[var(--sn-green)]">{t(messages, "settings.privacy")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--sn-muted)]">
          {t(messages, "settings.privacyBody")}
        </p>
      </section>

      <Link href="/about" className="sn-btn sn-btn-secondary mt-6 w-full">
        {t(messages, "about.nav")}
      </Link>

      <button className="sn-btn sn-btn-secondary mt-3 w-full" onClick={reset}>
        {t(messages, "settings.reset")}
      </button>
    </main>
  );
}
