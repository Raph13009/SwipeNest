"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAppStore } from "@/store/useAppStore";

const PROVIDERS_URL =
  "https://supabase.com/dashboard/project/txlxewzmymilmsaefsas/auth/providers";

function formatAuthError(raw: string, fr: boolean) {
  const lower = raw.toLowerCase();
  if (lower.includes("provider is not enabled") || lower.includes("unsupported provider")) {
    return fr
      ? "Google n’est pas encore activé sur Supabase. Ouvre Auth → Providers → Google, colle ton Client ID + Secret Google Cloud, puis Enable."
      : "Google is not enabled on Supabase yet. Open Auth → Providers → Google, paste your Google Cloud Client ID + Secret, then Enable.";
  }
  return raw;
}

function LoginInner() {
  const { signInWithGoogle, configured, user, loading } = useAuth();
  const locale = useAppStore((s) => s.locale);
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const fr = locale === "fr";
  const [error, setError] = useState<string | null>(
    searchParams.get("error")
      ? fr
        ? "Connexion interrompue."
        : "Sign-in was interrupted."
      : null
  );
  const [providerHint, setProviderHint] = useState(false);

  const onGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setProviderHint(false);
    try {
      const next = searchParams.get("next") || "/discover";
      await signInWithGoogle(next);
    } catch (e) {
      setBusy(false);
      const msg =
        e instanceof Error
          ? e.message
          : fr
            ? "Impossible de lancer Google SSO."
            : "Could not start Google SSO.";
      setError(formatAuthError(msg, fr));
      if (msg.toLowerCase().includes("provider")) setProviderHint(true);
    }
  };

  return (
    <main className="page flex min-h-[70vh] flex-col items-center justify-center">
      <Logo />
      <div className="sn-card mt-8 w-full max-w-md p-7">
        <h1 className="text-2xl font-bold text-[var(--sn-green)]">
          {fr ? "Connexion" : "Sign in"}
        </h1>
        <p className="mt-2 text-sm text-[var(--sn-muted)]">
          {fr
            ? "Compte Supabase uniquement — plus de cache navigateur."
            : "Supabase account only — no browser account cache."}
        </p>

        {!configured && (
          <p className="mt-4 rounded-2xl bg-[#f8d4d4] px-3 py-2 text-sm text-[#8f2f2f]">
            {fr
              ? "Supabase n’est pas configuré (variables d’env manquantes)."
              : "Supabase is not configured (missing env vars)."}
          </p>
        )}

        {user && !loading && (
          <p className="mt-4 rounded-2xl bg-[rgba(167,196,184,0.35)] px-3 py-2 text-sm text-[var(--sn-green)]">
            {fr ? "Déjà connecté :" : "Already signed in:"} {user.email}
          </p>
        )}

        {error && (
          <div className="mt-4 space-y-2 rounded-2xl bg-[#f8d4d4] px-3 py-3 text-sm text-[#8f2f2f]">
            <p>{error}</p>
            {providerHint && (
              <a
                href={PROVIDERS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-block font-bold underline"
              >
                {fr ? "Ouvrir Auth → Google" : "Open Auth → Google"}
              </a>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onGoogle}
          disabled={!configured || busy}
          className="sn-btn mt-6 flex w-full items-center justify-center gap-3 disabled:opacity-60"
        >
          <GoogleMark />
          {busy
            ? fr
              ? "Redirection…"
              : "Redirecting…"
            : fr
              ? "Continuer avec Google"
              : "Continue with Google"}
        </button>

        <p className="mt-4 text-[11px] leading-relaxed text-[var(--sn-muted)]">
          {fr ? (
            <>
              Redirect URI Google Cloud :{" "}
              <code className="text-[10px]">
                https://txlxewzmymilmsaefsas.supabase.co/auth/v1/callback
              </code>
            </>
          ) : (
            <>
              Google Cloud redirect URI:{" "}
              <code className="text-[10px]">
                https://txlxewzmymilmsaefsas.supabase.co/auth/v1/callback
              </code>
            </>
          )}
        </p>

        <Link
          href="/"
          className="mt-4 block text-center text-sm font-semibold text-[var(--sn-muted)] hover:text-[var(--sn-green)]"
        >
          {fr ? "Retour" : "Back"}
        </Link>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="page flex min-h-[50vh] items-center justify-center text-[var(--sn-muted)]">
          …
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.1 4 9.2 8.5 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.1 39.4 16 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.5 7.1l.1.1 6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
