"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { getMessages, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { UserPreferences } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

const ARRS = Array.from({ length: 20 }, (_, i) => i + 1);
const TYPES = ["apartment", "studio", "loft", "duplex"];
const AMENITIES = ["balcony", "elevator", "hardwood_floors", "dishwasher", "washer", "parking", "garden"];
const LIFESTYLE = ["walkable", "cafes", "parks", "quiet", "nightlife", "metro"];
const AESTHETIC = ["bright", "haussmannian", "modern", "minimalist", "parquet", "industrial"];
const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const storePrefs = useAppStore((s) => s.preferences);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const messages = getMessages(locale);

  const [prefs, setPrefs] = useState<UserPreferences>(() => ({ ...storePrefs }));
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (partial: Partial<UserPreferences>) => {
    setPrefs((p) => ({ ...p, ...partial }));
  };

  const toggle = (key: keyof UserPreferences, value: string | number) => {
    const current = prefs[key];
    if (!Array.isArray(current)) return;
    const exists = (current as Array<string | number>).includes(value as never);
    const next = exists
      ? (current as Array<string | number>).filter((x) => x !== value)
      : [...(current as Array<string | number>), value];
    update({ [key]: next } as Partial<UserPreferences>);
  };

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      // Fast path: backend onboarding must stay lightweight (no model load).
      await completeOnboarding({ ...prefs, language: locale }, false);
      router.replace("/discover");
    } catch (e) {
      console.error(e);
      setError(t(messages, "common.error"));
      setSaving(false);
    }
  };

  return (
    <main className="page max-w-lg">
      <Logo />
      <div className="mt-6 mb-2 flex gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= step ? "bg-[var(--sn-green)]" : "bg-[rgba(27,77,62,0.12)]"
            )}
          />
        ))}
      </div>
      <h1 className="mt-4 text-2xl font-bold text-[var(--sn-green)]">
        {t(messages, "onboarding.title")}
      </h1>

      <div className="sn-card mt-6 p-5">
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--sn-muted)]">
                {t(messages, "onboarding.name")}
              </label>
              <input
                className="sn-input"
                value={prefs.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="Camille"
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--sn-muted)]">
                {t(messages, "onboarding.budget")} — €{prefs.max_rent}
              </label>
              <input
                type="range"
                min={700}
                max={4500}
                step={50}
                value={prefs.max_rent}
                onChange={(e) => update({ max_rent: Number(e.target.value) })}
                className="w-full accent-[var(--sn-green)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[var(--sn-muted)]">
                {t(messages, "onboarding.surface")} — {prefs.min_surface} m²
              </label>
              <input
                type="range"
                min={15}
                max={120}
                step={1}
                value={prefs.min_surface}
                onChange={(e) => update({ min_surface: Number(e.target.value) })}
                className="w-full accent-[var(--sn-green)]"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--sn-muted)]">
                {t(messages, "onboarding.areas")}
              </p>
              <div className="flex flex-wrap gap-2">
                {ARRS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    data-active={prefs.arrondissements.includes(n)}
                    className="sn-chip"
                    onClick={() => toggle("arrondissements", n)}
                  >
                    {n}e
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--sn-muted)]">
                {t(messages, "onboarding.type")}
              </p>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    data-active={prefs.apartment_types.includes(type)}
                    className="sn-chip capitalize"
                    onClick={() => toggle("apartment_types", type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--sn-muted)]">
                {t(messages, "onboarding.furnished")}
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["any", "onboarding.any"],
                    ["furnished", "onboarding.furnishedYes"],
                    ["unfurnished", "onboarding.furnishedNo"],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    data-active={prefs.furnished === val}
                    className="sn-chip"
                    onClick={() => update({ furnished: val })}
                  >
                    {t(messages, label)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--sn-muted)]">
                {t(messages, "onboarding.amenities")}
              </p>
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    data-active={prefs.amenities.includes(a)}
                    className="sn-chip"
                    onClick={() => toggle("amenities", a)}
                  >
                    {a.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--sn-muted)]">
                {t(messages, "onboarding.lifestyle")}
              </p>
              <div className="flex flex-wrap gap-2">
                {LIFESTYLE.map((a) => (
                  <button
                    key={a}
                    type="button"
                    data-active={prefs.lifestyle.includes(a)}
                    className="sn-chip"
                    onClick={() => toggle("lifestyle", a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--sn-muted)]">
                {t(messages, "onboarding.aesthetic")}
              </p>
              <div className="flex flex-wrap gap-2">
                {AESTHETIC.map((a) => (
                  <button
                    key={a}
                    type="button"
                    data-active={prefs.aesthetic.includes(a)}
                    className="sn-chip"
                    onClick={() => toggle("aesthetic", a)}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-[var(--sn-muted)]">
              {t(messages, "onboarding.dream")}
            </label>
            <textarea
              className="sn-textarea min-h-[160px]"
              value={prefs.dream_description}
              onChange={(e) => update({ dream_description: e.target.value })}
              placeholder={t(messages, "onboarding.dreamPlaceholder")}
            />
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-[var(--sn-danger)]">{error}</p>}

      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <button
            type="button"
            className="sn-btn sn-btn-secondary flex-1"
            disabled={saving}
            onClick={() => setStep((s) => s - 1)}
          >
            {t(messages, "onboarding.back")}
          </button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <button
            type="button"
            className="sn-btn sn-btn-primary flex-1"
            onClick={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
          >
            {t(messages, "onboarding.next")}
          </button>
        ) : (
          <button
            type="button"
            className="sn-btn sn-btn-primary flex-1"
            disabled={saving}
            onClick={finish}
          >
            {saving ? t(messages, "common.loading") : t(messages, "onboarding.finish")}
          </button>
        )}
      </div>
    </main>
  );
}
