"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { FOUNDERS } from "@/lib/founders";
import { getMessages, t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";

export default function AboutPage() {
  const locale = useAppStore((s) => s.locale);
  const messages = getMessages(locale);
  const lang = locale === "fr" ? "fr" : "en";

  return (
    <main data-about className="page max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Logo />
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[var(--sn-green)] shadow-sm"
        >
          <ArrowLeft size={16} />
          {t(messages, "about.backHome")}
        </Link>
      </div>

      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sn-muted)]">
          SwipeNest AI
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--sn-green)] sm:text-4xl">
          {t(messages, "about.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-[1.05rem] leading-relaxed text-[var(--sn-muted)]">
          {t(messages, "about.intro")}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {FOUNDERS.map((founder) => (
          <article key={founder.id} className="sn-card flex gap-4 p-4 sm:p-5">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-sm"
              style={{ backgroundColor: founder.accent }}
              aria-hidden
            >
              {founder.initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[var(--sn-ink)]">{founder.name}</h2>
              <p className="mt-0.5 text-sm font-semibold text-[var(--sn-green)]">
                {founder.role[lang]}
              </p>
              <p className="mt-1 text-sm text-[var(--sn-muted)]">{founder.detail[lang]}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--sn-sage)]">
                {founder.location}
              </p>
            </div>
          </article>
        ))}
      </section>

      <p className="mt-8 text-sm leading-relaxed text-[var(--sn-muted)]">
        {t(messages, "about.footnote")}
      </p>
    </main>
  );
}
