"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export function AuthForm({
  initialMode = "signup",
  next = "/discover",
}: {
  initialMode?: "signin" | "signup";
  next?: string;
}) {
  const { signInWithPassword, signUpWithPassword, configured } = useAuth();
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const router = useRouter();
  const fr = locale === "fr";

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      router.replace(next);
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
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <div className="flex rounded-full border border-[rgba(27,77,62,0.12)] bg-white p-1">
          {(["en", "fr"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLocale(lang)}
              className={`min-h-9 min-w-10 rounded-full px-2.5 text-xs font-bold uppercase ${
                locale === lang
                  ? "bg-[var(--sn-green)] text-white"
                  : "text-[var(--sn-muted)]"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      <div className="sn-card p-7">
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
            ? "Trouve ton appart à Paris en quelques swipes."
            : "Find your Paris flat in a few swipes."}
        </p>

        {!configured && (
          <p className="mt-4 rounded-2xl bg-[#f8d4d4] px-3 py-2 text-sm text-[#8f2f2f]">
            {fr
              ? "Supabase n’est pas configuré."
              : "Supabase is not configured."}
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
              ? "…"
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
      </div>
    </div>
  );
}
