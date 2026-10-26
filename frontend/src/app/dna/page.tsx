"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/brand/Logo";
import { getMessages, t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/api";

const DIM_KEYS = [
  "interior_design",
  "natural_light",
  "architecture",
  "apartment_size",
  "neighborhoods",
  "layout",
  "materials_finishes",
  "amenities",
] as const;

const DIM_LABEL: Record<string, string> = {
  interior_design: "interior_design",
  natural_light: "natural_light",
  architecture: "architecture",
  apartment_size: "apartment_size",
  neighborhoods: "neighborhoods_dim",
  layout: "layout",
  materials_finishes: "materials_finishes",
  amenities: "amenities_dim",
};

export default function DnaPage() {
  const locale = useAppStore((s) => s.locale);
  const tasteDna = useAppStore((s) => s.tasteDna);
  const refreshDna = useAppStore((s) => s.refreshDna);
  const messages = getMessages(locale);

  useEffect(() => {
    refreshDna().catch(() => undefined);
  }, [refreshDna]);

  const reset = async () => {
    await api.resetDna();
    await refreshDna();
  };

  return (
    <main className="page">
      <Logo />
      <header className="mt-6">
        <h1 className="text-3xl font-bold text-[var(--sn-green)]">{t(messages, "dna.title")}</h1>
        <p className="mt-2 text-[var(--sn-muted)]">{t(messages, "dna.subtitle")}</p>
        {tasteDna && (
          <p className="mt-2 text-sm font-semibold text-[var(--sn-sage)]">
            {tasteDna.interaction_count} {t(messages, "dna.interactions")} · {tasteDna.likes}{" "}
            {tasteDna.likes === 1 ? "like" : "likes"} · {tasteDna.rejects}{" "}
            {tasteDna.rejects === 1 ? "reject" : "rejects"}
          </p>
        )}
      </header>

      {!tasteDna || tasteDna.interaction_count === 0 ? (
        <div className="sn-card mt-8 p-8 text-center text-[var(--sn-muted)]">
          {t(messages, "dna.empty")}
        </div>
      ) : (
        <>
          <section className="mt-8 grid gap-3 sm:grid-cols-2">
            {DIM_KEYS.map((key, i) => {
              const value = tasteDna.dimensions[key] ?? 0.5;
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="sn-card p-4"
                >
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-[var(--sn-green)]">
                      {t(messages, `dna.${DIM_LABEL[key]}`)}
                    </span>
                    <span className="text-[var(--sn-muted)]">{Math.round(value * 100)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[var(--sn-beige-deep)]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background:
                          value > 0.55
                            ? "linear-gradient(90deg, #A7C4B8, #1B4D3E)"
                            : "linear-gradient(90deg, #FADADD, #A7C4B8)",
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(value * 100)}%` }}
                      transition={{ duration: 0.6, delay: 0.05 * i }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </section>

          <section className="sn-card mt-6 p-5">
            <h2 className="font-bold text-[var(--sn-green)]">{t(messages, "dna.insights")}</h2>
            <ul className="mt-3 space-y-2">
              {tasteDna.insights.map((insight) => (
                <li
                  key={insight}
                  className="rounded-2xl bg-[rgba(250,218,221,0.45)] px-4 py-3 text-sm leading-relaxed text-[var(--sn-ink)]"
                >
                  {insight}
                </li>
              ))}
            </ul>
          </section>

          <AffinityBlock title={t(messages, "dna.styles")} data={tasteDna.style_affinity} />
          <AffinityBlock title={t(messages, "dna.neighborhoods")} data={tasteDna.neighborhood_affinity} suffix="e" />
          <AffinityBlock title={t(messages, "dna.amenities")} data={tasteDna.amenity_affinity} />
        </>
      )}

      <button className="sn-btn sn-btn-secondary mt-8 w-full" onClick={reset}>
        {t(messages, "dna.reset")}
      </button>
    </main>
  );
}

function AffinityBlock({
  title,
  data,
  suffix = "",
}: {
  title: string;
  data: Record<string, number>;
  suffix?: string;
}) {
  const entries = Object.entries(data);
  if (!entries.length) return null;
  return (
    <section className="sn-card mt-4 p-5">
      <h2 className="font-bold text-[var(--sn-green)]">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {entries.map(([k, v]) => (
          <span key={k} className="sn-chip">
            {k.replaceAll("_", " ")}
            {suffix} · {Math.round(v * 100)}
          </span>
        ))}
      </div>
    </section>
  );
}
