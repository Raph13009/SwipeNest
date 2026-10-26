"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { api, mediaUrl } from "@/lib/api";
import { arrLabel, formatRent } from "@/lib/utils";
import { getMessages, t } from "@/lib/i18n";
import type { Listing } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export default function FavoritesPage() {
  const locale = useAppStore((s) => s.locale);
  const messages = getMessages(locale);
  const [items, setItems] = useState<Listing[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [compare, setCompare] = useState<{
    items: Array<Record<string, unknown>>;
    insights: string[];
    winner_id: string;
  } | null>(null);

  const load = async () => {
    const res = await api.favorites();
    setItems(res.items);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const remove = async (id: string) => {
    await api.removeFavorite(id);
    setSelected((s) => s.filter((x) => x !== id));
    await load();
  };

  const runCompare = async () => {
    if (selected.length < 2) return;
    const res = await api.compare(selected);
    setCompare(res);
  };

  return (
    <RequireAuth>
    <main className="page">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[var(--sn-green)] lg:text-2xl">{t(messages, "saved.title")}</h1>
        <button
          className="sn-btn sn-btn-primary text-sm"
          disabled={selected.length < 2}
          onClick={runCompare}
        >
          {t(messages, "saved.compare")}
        </button>
      </div>

      {!items.length && (
        <div className="sn-card mt-8 p-8 text-center text-[var(--sn-muted)]">
          {t(messages, "saved.empty")}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const active = selected.includes(item.id);
          return (
            <div key={item.id} className="sn-card overflow-hidden">
              <Link href={`/listing/${item.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(item.image)} alt="" className="h-48 w-full object-cover" />
              </Link>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-[var(--sn-green)]">{formatRent(item.rent_eur, locale)}</p>
                    <p className="text-sm text-[var(--sn-muted)]">
                      {arrLabel(item.arrondissement, locale)} · {item.surface_m2} m²
                    </p>
                  </div>
                  <button
                    className={`sn-chip ${active ? "" : ""}`}
                    data-active={active}
                    onClick={() => toggle(item.id)}
                  >
                    {active ? "✓" : "+"}
                  </button>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium">{item.title}</p>
                <div className="mt-3 flex gap-2">
                  <Link href={`/listing/${item.id}`} className="sn-btn sn-btn-secondary flex-1 text-sm">
                    {t(messages, "listing.details")}
                  </Link>
                  <button className="sn-btn sn-btn-pink flex-1 text-sm" onClick={() => remove(item.id)}>
                    {t(messages, "saved.remove")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {compare && (
        <section className="sn-card mt-8 p-5">
          <h2 className="text-xl font-bold text-[var(--sn-green)]">{t(messages, "compare.title")}</h2>
          <p className="mt-1 text-sm text-[var(--sn-muted)]">
            {t(messages, "compare.winner")}: {compare.winner_id}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {compare.items.map((it) => (
              <div key={String(it.id)} className="rounded-2xl bg-[var(--sn-beige)] p-3 text-sm">
                <p className="font-bold text-[var(--sn-green)]">{String(it.title)}</p>
                <p className="mt-1">{formatRent(Number(it.rent_eur), locale)}</p>
                <p>
                  {Number(it.surface_m2)} m² · Match {Number(it.match_score)}%
                </p>
              </div>
            ))}
          </div>
          <h3 className="mt-4 font-semibold text-[var(--sn-green)]">{t(messages, "compare.insights")}</h3>
          <ul className="mt-2 space-y-2">
            {compare.insights.map((insight) => (
              <li key={insight} className="rounded-xl bg-[rgba(167,196,184,0.25)] px-3 py-2 text-sm">
                {insight}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
    </RequireAuth>
  );
}
