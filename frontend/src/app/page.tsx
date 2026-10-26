"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { getMessages, t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/components/auth/AuthProvider";

const HERO =
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1800&q=80";

export default function WelcomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const preferences = useAppStore((s) => s.preferences);
  const messages = getMessages(locale);
  const [busy, setBusy] = useState(false);

  const primaryAction = async () => {
    if (busy || authLoading) return;
    setBusy(true);
    try {
      if (!user) {
        router.push(
          `/login?next=${encodeURIComponent(onboardingComplete ? "/discover" : "/onboarding")}`
        );
        return;
      }
      if (onboardingComplete) {
        router.push("/discover");
        return;
      }
      await completeOnboarding(preferences, true);
      router.push("/discover");
    } catch {
      setBusy(false);
      if (!user) router.push("/login");
    }
  };

  const ctaLabel = !user
    ? locale === "fr"
      ? "Créer un compte"
      : "Create account"
    : onboardingComplete
      ? t(messages, "welcome.continue")
      : busy
        ? t(messages, "common.loading")
        : t(messages, "welcome.demo");

  const headline =
    locale === "fr" ? (
      <>
        Trouvez l’appart
        <br />
        qui vous ressemble.
      </>
    ) : (
      <>
        Find a home
        <br />
        that gets you.
      </>
    );

  return (
    <main data-home className="fixed inset-0 z-[60] overflow-hidden bg-[#0f241c]">
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.1, opacity: 0.85 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 6.5, ease: "easeOut" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO} alt="" className="h-full w-full object-cover" fetchPriority="high" />
      </motion.div>

      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-black/78" />

      <div className="relative z-10 flex h-full flex-col">
        <header className="flex items-center justify-between gap-3 px-5 pt-[max(1.1rem,env(safe-area-inset-top))] sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-2.5"
          >
            <Image
              src="/brand/logo.svg"
              alt=""
              width={36}
              height={36}
              className="brightness-0 invert"
              priority
            />
            <span className="text-[1.4rem] font-bold tracking-tight text-white sm:text-[1.55rem]">
              SwipeNest
              <sup className="ml-1 text-[0.55em] font-semibold text-[#FADADD]">AI</sup>
            </span>
          </motion.div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full border border-white/15 bg-black/25 px-3.5 py-2 text-xs font-semibold text-white/90 backdrop-blur-md"
            >
              {locale === "fr" ? "Connexion" : "Sign in"}
            </Link>
            <Link
              href="/about"
              className="rounded-full border border-white/15 bg-black/25 px-3.5 py-2 text-xs font-semibold text-white/90 backdrop-blur-md"
            >
              {t(messages, "about.nav")}
            </Link>
            <div className="flex rounded-full border border-white/15 bg-black/25 p-1 backdrop-blur-md">
              {(["en", "fr"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLocale(lang)}
                  className={`min-h-9 min-w-11 rounded-full px-3 text-xs font-bold uppercase tracking-wide transition ${
                    locale === lang ? "bg-white text-[#1B4D3E]" : "text-white/75"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-end px-5 pb-3 sm:px-8 lg:justify-center lg:pb-8">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[34rem]"
          >
            <p className="mb-3 text-[0.78rem] font-semibold uppercase tracking-[0.24em] text-[#FADADD]">
              Paris
            </p>
            <h1 className="text-[2.55rem] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.75rem]">
              {headline}
            </h1>
            <p className="mt-4 max-w-sm text-[1.05rem] leading-relaxed text-white/78 sm:text-lg">
              {t(messages, "brand.subtitle")}
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28 }}
          className="px-5 pb-[max(1.35rem,calc(env(safe-area-inset-bottom)+1rem))] sm:px-8"
        >
          <div className="w-full max-w-[34rem]">
            <button
              type="button"
              disabled={busy || authLoading}
              className="inline-flex min-h-[56px] w-full items-center justify-center rounded-full bg-white px-6 text-[1.02rem] font-bold text-[#1B4D3E] shadow-[0_12px_40px_rgba(0,0,0,0.28)] transition active:scale-[0.98] disabled:opacity-70"
              onClick={primaryAction}
            >
              {busy && !user ? (locale === "fr" ? "Redirection…" : "Redirecting…") : ctaLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
