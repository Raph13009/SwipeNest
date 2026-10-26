"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Heart, RotateCcw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { api, mediaUrl } from "@/lib/api";
import { arrLabel, cn, formatRent } from "@/lib/utils";
import { getMessages, t } from "@/lib/i18n";
import type { Listing, RejectionReason } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import { WhyModal } from "@/components/swipe/WhyModal";
import { RejectReasonSheet } from "@/components/swipe/RejectReasonSheet";

const REASONS: RejectionReason[] = [
  "too_expensive",
  "too_small",
  "too_dark",
  "wrong_neighborhood",
  "disliked_style",
  "missing_amenities",
  "other",
];

export function SwipeDeck() {
  const locale = useAppStore((s) => s.locale);
  const feed = useAppStore((s) => s.feed);
  const refreshFeed = useAppStore((s) => s.refreshFeed);
  const refreshDna = useAppStore((s) => s.refreshDna);
  const syncUser = useAppStore((s) => s.syncUser);
  const messages = getMessages(locale);

  const [index, setIndex] = useState(0);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const [busy, setBusy] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [pendingReject, setPendingReject] = useState<Listing | null>(null);

  const cards = useMemo(() => feed.slice(index, index + 3), [feed, index]);
  const current = cards[0];

  useEffect(() => {
    if (feed.length - index < 5) {
      refreshFeed().catch(() => undefined);
    }
  }, [feed.length, index, refreshFeed]);

  const commit = useCallback(
    async (listing: Listing, action: "like" | "reject", reason?: RejectionReason) => {
      setBusy(true);
      try {
        await api.swipe(listing.id, action, reason);
        await Promise.all([syncUser(), refreshDna()]);
        setIndex((i) => i + 1);
        if (action === "like") {
          try {
            navigator.vibrate?.(12);
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        toast.error(t(messages, "common.error"));
        console.error(e);
      } finally {
        setBusy(false);
        setExitDir(null);
      }
    },
    [messages, refreshDna, syncUser]
  );

  const onLike = async () => {
    if (!current || busy) return;
    setExitDir("right");
    await commit(current, "like");
  };

  const onReject = () => {
    if (!current || busy) return;
    setPendingReject(current);
    setRejectOpen(true);
  };

  const finishReject = async (reason?: RejectionReason) => {
    if (!pendingReject) return;
    setRejectOpen(false);
    setExitDir("left");
    await commit(pendingReject, "reject", reason);
    setPendingReject(null);
  };

  const onUndo = async () => {
    try {
      await api.undo();
      setIndex((i) => Math.max(0, i - 1));
      await Promise.all([syncUser(), refreshFeed(), refreshDna()]);
      toast(t(messages, "discover.undo"));
    } catch {
      toast.error(t(messages, "common.error"));
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") void onLike();
      if (e.key === "ArrowLeft") onReject();
      if (e.key === "u" || e.key === "U") void onUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!current) {
    return (
      <div className="sn-card flex min-h-[70vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <Sparkles className="text-[var(--sn-sage)]" />
        <p className="max-w-sm text-[var(--sn-muted)]">{t(messages, "discover.empty")}</p>
        <button className="sn-btn sn-btn-primary" onClick={() => refreshFeed()}>
          {t(messages, "common.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <div className="relative mx-auto aspect-[3/4.05] w-full max-h-[min(62vh,560px)]">
        <AnimatePresence>
          {cards
            .slice()
            .reverse()
            .map((listing, revIdx) => {
              const depth = cards.length - 1 - revIdx;
              const isTop = depth === 0;
              return (
                <SwipeCard
                  key={listing.id}
                  listing={listing}
                  depth={depth}
                  isTop={isTop}
                  locale={locale}
                  messages={messages}
                  exitDir={isTop ? exitDir : null}
                  disabled={busy || !isTop}
                  onSwipeLeft={() => onReject()}
                  onSwipeRight={() => onLike()}
                  onWhy={() => setWhyOpen(true)}
                />
              );
            })}
        </AnimatePresence>
      </div>

      <div className="relative z-20 mt-4 mb-2 flex items-center justify-center gap-4 pb-2">
        <button
          aria-label="Undo"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--sn-muted)] shadow-md"
          onClick={onUndo}
        >
          <RotateCcw size={20} />
        </button>
        <button
          aria-label="Reject"
          disabled={busy}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[var(--sn-danger)] shadow-lg"
          onClick={onReject}
        >
          <X size={28} strokeWidth={2.5} />
        </button>
        <button
          aria-label="Like"
          disabled={busy}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sn-green)] text-white shadow-lg"
          onClick={onLike}
        >
          <Heart size={26} fill="currentColor" />
        </button>
        <button
          aria-label="Why"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--sn-pink)] text-[var(--sn-green)] shadow-md"
          onClick={() => setWhyOpen(true)}
        >
          <Sparkles size={20} />
        </button>
      </div>

      <WhyModal
        open={whyOpen}
        listingId={current.id}
        onClose={() => setWhyOpen(false)}
      />
      <RejectReasonSheet
        open={rejectOpen}
        reasons={REASONS}
        onSkip={() => finishReject()}
        onSelect={(r) => finishReject(r)}
        onClose={() => {
          setRejectOpen(false);
          setPendingReject(null);
        }}
      />
    </div>
  );
}

function SwipeCard({
  listing,
  depth,
  isTop,
  locale,
  messages,
  exitDir,
  disabled,
  onSwipeLeft,
  onSwipeRight,
  onWhy,
}: {
  listing: Listing;
  depth: number;
  isTop: boolean;
  locale: "en" | "fr";
  messages: ReturnType<typeof getMessages>;
  exitDir: "left" | "right" | null;
  disabled: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onWhy: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const likeOpacity = useTransform(x, [40, 140], [0, 1]);
  const nopeOpacity = useTransform(x, [-140, -40], [1, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (disabled) return;
    if (info.offset.x > 120 || info.velocity.x > 700) onSwipeRight();
    else if (info.offset.x < -120 || info.velocity.x < -700) onSwipeLeft();
  };

  return (
    <motion.article
      className={cn(
        "absolute inset-0 overflow-hidden sn-card touch-none select-none",
        !isTop && "pointer-events-none"
      )}
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        zIndex: 10 - depth,
        scale: 1 - depth * 0.04,
        y: depth * 12,
      }}
      drag={isTop && !disabled ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{
        scale: 1 - depth * 0.04,
        opacity: 1,
        x: exitDir === "left" ? -480 : exitDir === "right" ? 480 : 0,
        rotate: exitDir === "left" ? -18 : exitDir === "right" ? 18 : 0,
      }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <div className="relative h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl(listing.image)}
          alt={listing.title}
          className="h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10" />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {listing.scam_risk && listing.scam_risk !== "low" && (
            <span className={cn("rounded-full px-3 py-1 text-xs font-bold", `risk-${listing.scam_risk}`)}>
              {t(messages, `scam.${listing.scam_risk}`)}
            </span>
          )}
        </div>

        <div className="absolute right-4 top-4">
          <div className="match-badge">
            {t(messages, "discover.match")} {Math.round(listing.match_score || 0)}%
          </div>
        </div>

        {isTop && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute left-6 top-24 rotate-[-12deg] rounded-xl border-4 border-emerald-300 px-3 py-1 text-2xl font-black uppercase text-emerald-200"
            >
              Like
            </motion.div>
            <motion.div
              style={{ opacity: nopeOpacity }}
              className="absolute right-6 top-24 rotate-[12deg] rounded-xl border-4 border-rose-300 px-3 py-1 text-2xl font-black uppercase text-rose-200"
            >
              Nope
            </motion.div>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <p className="text-3xl font-bold tracking-tight">
            {formatRent(listing.rent_eur, locale)}
            <span className="ml-1 text-base font-medium opacity-80">{t(messages, "discover.month")}</span>
          </p>
          <p className="mt-1 text-lg font-semibold">
            {arrLabel(listing.arrondissement, locale)} · {listing.neighborhood}
          </p>
          <p className="mt-1 text-sm opacity-90">
            {listing.surface_m2} m² · {listing.rooms} {t(messages, "discover.rooms")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {listing.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur"
              >
                {tag}
              </span>
            ))}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onWhy();
            }}
            className="mt-4 text-left text-sm font-semibold text-[var(--sn-pink)]"
          >
            {t(messages, "discover.why")}
          </button>
        </div>
      </div>
    </motion.article>
  );
}
