"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Shield } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { WhyModal } from "@/components/swipe/WhyModal";
import { api, mediaUrl } from "@/lib/api";
import { arrLabel, cn, formatRent } from "@/lib/utils";
import { getMessages, t } from "@/lib/i18n";
import type { ApplicationDraft, Listing, ScamAssessment } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";

export default function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const messages = getMessages(locale);
  const [listing, setListing] = useState<Listing | null>(null);
  const [scam, setScam] = useState<ScamAssessment | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [draft, setDraft] = useState<ApplicationDraft | null>(null);
  const [tone, setTone] = useState<"professional" | "warm" | "concise">("professional");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    api.listing(id).then(setListing).catch(() => setListing(null));
    api.scam(id).then(setScam).catch(() => undefined);
  }, [id]);

  const generate = async () => {
    if (!id) return;
    const res = await api.apply(id, tone, locale === "fr" ? "fr" : "en");
    setDraft(res);
    setMessage(res.message);
    setApplyOpen(true);
  };

  if (!listing) {
    return (
      <main className="page">
        <Logo />
        <p className="mt-10 text-[var(--sn-muted)]">{t(messages, "common.loading")}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="mb-4 flex items-center justify-between">
        <button
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow"
          onClick={() => router.back()}
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <Logo wordmark={false} />
        <div className="w-11" />
      </div>

      <div className="overflow-hidden rounded-[28px] shadow-[var(--sn-card-shadow)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl(listing.image)} alt={listing.title} className="h-[48vh] w-full object-cover" />
      </div>

      <div className="mt-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-bold text-[var(--sn-green)]">
            {formatRent(listing.rent_eur, locale)}
            <span className="ml-1 text-base font-medium text-[var(--sn-muted)]">
              {t(messages, "discover.month")}
            </span>
          </p>
          <p className="mt-1 text-lg font-semibold">
            {arrLabel(listing.arrondissement, locale)} · {listing.neighborhood}
          </p>
          <p className="text-sm text-[var(--sn-muted)]">
            {listing.surface_m2} m² · {listing.rooms} {t(messages, "discover.rooms")} ·{" "}
            {t(messages, "listing.floor")} {listing.floor}
          </p>
        </div>
        <div className="match-badge">{Math.round(listing.match_score || 0)}%</div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-[var(--sn-ink)]">{listing.description}</p>
      <p className="mt-2 text-xs text-[var(--sn-muted)]">{t(messages, "listing.disclaimer")}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {listing.tags.map((tag) => (
          <span key={tag} className="sn-chip">
            {tag}
          </span>
        ))}
      </div>

      <section className="sn-card mt-5 p-5">
        <h2 className="font-bold text-[var(--sn-green)]">{t(messages, "listing.amenities")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {listing.amenities.map((a) => (
            <span key={a} className="rounded-full bg-[var(--sn-beige)] px-3 py-1.5 text-sm">
              {a.replaceAll("_", " ")}
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm text-[var(--sn-muted)]">
          {t(messages, "listing.style")}: {listing.style} · {listing.property_type} ·{" "}
          {listing.furnished ? t(messages, "onboarding.furnishedYes") : t(messages, "onboarding.furnishedNo")}
        </p>
      </section>

      {scam && (
        <section className="sn-card mt-4 p-5">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[var(--sn-green)]" />
            <h2 className="font-bold text-[var(--sn-green)]">{t(messages, "listing.scam")}</h2>
          </div>
          <span className={cn("mt-3 inline-flex rounded-full px-3 py-1 text-sm font-bold", `risk-${scam.risk}`)}>
            {t(messages, `scam.${scam.risk}`)}
          </span>
          <h3 className="mt-4 text-sm font-semibold text-[var(--sn-muted)]">{t(messages, "scam.signals")}</h3>
          <ul className="mt-2 space-y-2">
            {scam.signals.length === 0 && (
              <li className="text-sm text-[var(--sn-muted)]">No major warning signs detected.</li>
            )}
            {scam.signals.map((s) => (
              <li key={s.code + s.detail} className="rounded-xl bg-[var(--sn-beige)] px-3 py-2 text-sm">
                {s.detail}
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-sm font-semibold text-[var(--sn-muted)]">{t(messages, "scam.advice")}</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {scam.advice.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-[var(--sn-muted)]">{scam.disclaimer}</p>
        </section>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button className="sn-btn sn-btn-secondary" onClick={() => setWhyOpen(true)}>
          {t(messages, "discover.why")}
        </button>
        <button className="sn-btn sn-btn-primary" onClick={generate}>
          {t(messages, "listing.apply")}
        </button>
      </div>

      <WhyModal open={whyOpen} listingId={listing.id} onClose={() => setWhyOpen(false)} />

      {applyOpen && draft && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="sn-card max-h-[90dvh] w-full max-w-lg overflow-y-auto p-5">
            <h2 className="text-xl font-bold text-[var(--sn-green)]">{t(messages, "apply.title")}</h2>
            <p className="mt-1 text-sm text-[var(--sn-muted)]">{t(messages, "apply.tone")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["professional", "warm", "concise"] as const).map((toneKey) => (
                <button
                  key={toneKey}
                  className="sn-chip"
                  data-active={tone === toneKey}
                  onClick={async () => {
                    setTone(toneKey);
                    const res = await api.apply(listing.id, toneKey, locale === "fr" ? "fr" : "en");
                    setDraft(res);
                    setMessage(res.message);
                  }}
                >
                  {t(messages, `apply.${toneKey}`)}
                </button>
              ))}
            </div>
            <textarea
              className="sn-textarea mt-4 min-h-[220px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              className="sn-btn sn-btn-primary mt-3 w-full"
              onClick={async () => {
                await navigator.clipboard.writeText(message);
                toast.success(t(messages, "apply.copy"));
              }}
            >
              <Copy size={16} />
              {t(messages, "apply.copy")}
            </button>
            <h3 className="mt-5 font-semibold text-[var(--sn-green)]">{t(messages, "apply.checklist")}</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {draft.checklist.map((c) => (
                <li key={c}>☐ {c}</li>
              ))}
            </ul>
            <ul className="mt-3 space-y-1 text-xs text-[var(--sn-muted)]">
              {draft.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <button className="sn-btn sn-btn-secondary mt-4 w-full" onClick={() => setApplyOpen(false)}>
              {t(messages, "explain.close")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
