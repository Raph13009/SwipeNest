"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { SwipeDeck } from "@/components/swipe/SwipeDeck";
import { getMessages, t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

export default function DiscoverPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const hydrated = useAppStore((s) => s.hydrated);
  const preferences = useAppStore((s) => s.preferences);
  const refreshFeed = useAppStore((s) => s.refreshFeed);
  const feed = useAppStore((s) => s.feed);
  const messages = getMessages(locale);

  useEffect(() => {
    if (hydrated && !onboardingComplete) router.replace("/onboarding");
  }, [hydrated, onboardingComplete, router]);

  useEffect(() => {
    if (onboardingComplete && feed.length === 0) {
      refreshFeed().catch(() => undefined);
    }
  }, [onboardingComplete, feed.length, refreshFeed]);

  return (
    <main className="page">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Logo />
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--sn-muted)]">
            {preferences.name ? `Hi, ${preferences.name}` : t(messages, "nav.discover")}
          </div>
          <Link
            href="/settings"
            aria-label={t(messages, "nav.settings")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--sn-green)] shadow-sm"
          >
            <Settings size={18} />
          </Link>
        </div>
      </div>
      <SwipeDeck />
    </main>
  );
}
