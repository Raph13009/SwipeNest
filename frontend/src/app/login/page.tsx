"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAppStore } from "@/store/useAppStore";

function formatAuthError(raw: string, fr: boolean) {
  const lower = raw.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return fr ? "Email ou mot de passe incorrect." : "Invalid email or password.";
  }
  if (lower.includes("user already registered")) {
    return fr ? "Ce compte existe déjà — connecte-toi." : "Account already exists — sign in.";
  }
  if (lower.includes("password")) {
    return fr
      ? "Mot de passe trop court (6 caractères mini)."
      : "Password too short (min 6 characters).";
  }
  return raw;
}

function LoginInner() {
  const { signInWithPassword, signUpWithPassword, configured, user } = useAuth();
  const locale = useAppStore((s) => s.locale);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fr = locale === "fr";

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error")
      ? fr
        ? "Connexion interrompue."
        : "Sign-in was interrupted."
      : null
  );

  const next =
    searchParams.get("next") || (onboardingComplete ? "/discover" : "/onboarding");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !configured) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        await signUpWithPassword(email, password);
      } else {
        await signInWithPassword(email, password);
      }
      router.push(next);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : fr
            ? "Impossible de continuer."
            : "Could not continue.";
      setError(formatAuthError(msg, fr));
      setBusy(false);
    }
  };

  return (
    <main className="page flex min-h-[70vh] flex-col items-center justify-center">
      <Logo />
      <div className="sn-card mt-8 w-full max-w-md p-7">
        <h1 className="text-2xl font-bold text-[var(--sn-green)]">
          {mode === "signup"
            ? fr
              ? "Créer un compte"
              : "Create account"
            : fr
              ? "Connexion"
              : "Sign in"}
        </h1>
        <p className="mt-2 text-sm text-[var(--sn-muted)]">
          {fr
            ? "Email + mot de passe — pas de vérification mail."
            : "Email + password — no email verification."}
        </p>

        {!configured && (
          <p className="mt-4 rounded-2xl bg-[#f8d4d4] px-3 py-2 text-sm text-[#8f2f2f]">
            {fr
              ? "Supabase n’est pas configuré (variables d’env manquantes)."
              : "Supabase is not configured (missing env vars)."}
          </p>
        )}

        {user && (
          <p className="mt-4 rounded-2xl bg-[rgba(167,196,184,0.35)] px-3 py-2 text-sm text-[var(--sn-green)]">
            {fr ? "Déjà connecté :" : "Already signed in:"} {user.email}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-2xl bg-[#f8d4d4] px-3 py-3 text-sm text-[#8f2f2f]">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--sn-muted)]">
              Email
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="sn-input"
              placeholder="toi@mail.com"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--sn-muted)]">
              {fr ? "Mot de passe" : "Password"}
            </span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="sn-input"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={!configured || busy}
            className="sn-btn sn-btn-primary mt-2 w-full disabled:opacity-60"
          >
            {busy
              ? fr
                ? "…"
                : "…"
              : mode === "signup"
                ? fr
                  ? "Créer mon compte"
                  : "Create account"
                : fr
                  ? "Se connecter"
                  : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-center text-sm font-semibold text-[var(--sn-muted)] hover:text-[var(--sn-green)]"
          onClick={() => {
            setMode((m) => (m === "signup" ? "signin" : "signup"));
            setError(null);
          }}
        >
          {mode === "signup"
            ? fr
              ? "Déjà un compte ? Se connecter"
              : "Already have an account? Sign in"
            : fr
              ? "Pas de compte ? S’inscrire"
              : "No account? Sign up"}
        </button>

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
