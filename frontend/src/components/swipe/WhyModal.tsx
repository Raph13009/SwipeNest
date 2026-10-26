"use client";

import { useEffect, useState } from "react";
import { Check, TriangleAlert, X } from "lucide-react";
import { api } from "@/lib/api";
import { getMessages, t } from "@/lib/i18n";
import type { Explanation } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export function WhyModal({
  open,
  listingId,
  onClose,
}: {
  open: boolean;
  listingId: string;
  onClose: () => void;
}) {
  const locale = useAppStore((s) => s.locale);
  const messages = getMessages(locale);
  const [data, setData] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .explain(listingId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, listingId]);

  if (!open) return null;

  const strengths = data?.factors.filter((f) => f.positive) || [];
  const compromises = data?.factors.filter((f) => !f.positive) || [];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="sn-card max-h-[88dvh] w-full max-w-md overflow-y-auto p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[var(--sn-green)]">
              {t(messages, "explain.title")}
            </h2>
            {data && (
              <p className="mt-1 text-sm text-[var(--sn-muted)]">
                {t(messages, "discover.match")} {Math.round(data.match_score)}%
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sn-beige-deep)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {loading && <p className="text-[var(--sn-muted)]">{t(messages, "common.loading")}</p>}

        {data && (
          <>
            <p className="mb-5 text-sm leading-relaxed text-[var(--sn-ink)]">{data.summary}</p>

            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--sn-muted)]">
              {t(messages, "explain.strengths")}
            </h3>
            <ul className="mb-5 space-y-2">
              {strengths.map((f) => (
                <li key={f.key} className="flex items-start gap-3 rounded-2xl bg-[rgba(167,196,184,0.25)] p-3">
                  <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--sn-green)] text-white">
                    <Check size={14} />
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--sn-green)]">{f.label}</p>
                    <p className="text-xs text-[var(--sn-muted)]">{Math.round(f.weight * 100)}%</p>
                  </div>
                </li>
              ))}
            </ul>

            {compromises.length > 0 && (
              <>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-[var(--sn-muted)]">
                  {t(messages, "explain.compromises")}
                </h3>
                <ul className="space-y-2">
                  {compromises.map((f) => (
                    <li
                      key={f.key}
                      className="flex items-start gap-3 rounded-2xl bg-[rgba(250,218,221,0.55)] p-3"
                    >
                      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--sn-pink)] text-[var(--sn-green)]">
                        <TriangleAlert size={14} />
                      </span>
                      <div>
                        <p className="font-semibold text-[var(--sn-green)]">{f.label}</p>
                        <p className="text-xs text-[var(--sn-muted)]">{Math.round(f.weight * 100)}%</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        <button className={cn("sn-btn sn-btn-primary mt-6 w-full")} onClick={onClose}>
          {t(messages, "explain.close")}
        </button>
      </div>
    </div>
  );
}
