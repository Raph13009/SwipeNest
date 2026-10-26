"use client";

import dynamic from "next/dynamic";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { getMessages, t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

const ParisMap = dynamic(
  () => import("@/components/map/ParisMap").then((m) => m.ParisMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[78vh] min-h-[480px] items-center justify-center overflow-hidden rounded-[28px] bg-[#f2eee5] text-[var(--sn-muted)] shadow-[var(--sn-card-shadow)]">
        Loading Paris…
      </div>
    ),
  }
);

export default function MapPage() {
  const locale = useAppStore((s) => s.locale);
  const messages = getMessages(locale);

  return (
    <RequireAuth>
      <main className="page !max-w-6xl">
        <h1 className="text-xl font-bold tracking-tight text-[var(--sn-green)] lg:text-2xl">
          {t(messages, "map.title")}
        </h1>
        <p className="mt-1 max-w-md text-sm text-[var(--sn-muted)]">{t(messages, "map.subtitle")}</p>
        <div className="mt-4">
          <ParisMap />
        </div>
      </main>
    </RequireAuth>
  );
}
