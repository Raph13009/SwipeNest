"use client";

import dynamic from "next/dynamic";
import { Logo } from "@/components/brand/Logo";
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
    <main className="page !max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Logo />
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-[var(--sn-green)] md:text-4xl">
            {t(messages, "map.title")}
          </h1>
          <p className="mt-1.5 max-w-md text-[var(--sn-muted)]">{t(messages, "map.subtitle")}</p>
        </div>
      </div>
      <div className="mt-5">
        <ParisMap />
      </div>
    </main>
  );
}
