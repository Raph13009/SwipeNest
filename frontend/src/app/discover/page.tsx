"use client";

import { useEffect } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { SwipeDeck } from "@/components/swipe/SwipeDeck";
import { getMessages, t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

export default function DiscoverPage() {
  const locale = useAppStore((s) => s.locale);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const refreshFeed = useAppStore((s) => s.refreshFeed);
  const feed = useAppStore((s) => s.feed);
  const messages = getMessages(locale);

  useEffect(() => {
    if (onboardingComplete && feed.length === 0) {
      refreshFeed().catch(() => undefined);
    }
  }, [onboardingComplete, feed.length, refreshFeed]);

  return (
    <RequireAuth>
      <main className="page">
        <h1 className="mb-3 text-xl font-bold text-[var(--sn-green)] lg:text-2xl">
          {t(messages, "nav.discover")}
        </h1>
        <SwipeDeck />
      </main>
    </RequireAuth>
  );
}
