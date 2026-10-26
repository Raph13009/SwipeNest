"use client";

import { useState } from "react";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { api, mediaUrl } from "@/lib/api";
import { arrLabel, formatRent } from "@/lib/utils";
import { getMessages, t } from "@/lib/i18n";
import type { Listing } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export default function SearchPage() {
  const locale = useAppStore((s) => s.locale);
  const messages = getMessages(locale);
  const [query, setQuery] = useState(
    locale === "fr"
      ? "Appartement haussmannien lumineux avec parquet sous 1500€"
      : "Bright Haussmannian apartment with wooden floors under €1,500"
  );
  const [refine, setRefine] = useState("");
  const [results, setResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async (withRefine = false) => {
    setLoading(true);
    try {
      const res = await api.search(query, withRefine ? refine : undefined);
      setResults(res.items);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <Logo />
      <h1 className="mt-6 text-3xl font-bold text-[var(--sn-green)]">{t(messages, "search.title")}</h1>

      <div className="sn-card mt-5 space-y-3 p-4">
        <textarea
          className="sn-textarea"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(messages, "search.placeholder")}
        />
        <button className="sn-btn sn-btn-primary w-full" onClick={() => run(false)} disabled={loading}>
          <SearchIcon size={18} />
          {loading ? t(messages, "common.loading") : t(messages, "search.search")}
        </button>
        <input
          className="sn-input"
          value={refine}
          onChange={(e) => setRefine(e.target.value)}
          placeholder={t(messages, "search.refinePlaceholder")}
        />
        <button className="sn-btn sn-btn-secondary w-full" onClick={() => run(true)} disabled={loading || !refine}>
          {t(messages, "search.refine")}
        </button>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-bold text-[var(--sn-green)]">{t(messages, "search.results")}</h2>
        {!results.length && !loading && (
          <p className="text-[var(--sn-muted)]">{t(messages, "search.empty")}</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <Link key={item.id} href={`/listing/${item.id}`} className="sn-card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(item.image)} alt="" className="h-44 w-full object-cover" />
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-[var(--sn-green)]">{formatRent(item.rent_eur, locale)}</p>
                  <span className="match-badge text-[0.7rem]">
                    {Math.round(item.match_score || 0)}%
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--sn-muted)]">
                  {arrLabel(item.arrondissement, locale)} · {item.surface_m2} m²
                </p>
                <p className="mt-2 line-clamp-2 text-sm">{item.title}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
