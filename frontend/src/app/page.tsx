"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAppStore } from "@/store/useAppStore";

function HomeInner() {
  const { user, loading } = useAuth();
  const hydrated = useAppStore((s) => s.hydrated);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/discover";
  const mode = searchParams.get("mode") === "signin" ? "signin" : "signup";

  useEffect(() => {
    if (!loading && hydrated && user) {
      router.replace(next.startsWith("/") ? next : "/discover");
    }
  }, [loading, hydrated, user, router, next]);

  if (loading || !hydrated || user) {
    return (
      <main className="page flex min-h-[60vh] items-center justify-center text-[var(--sn-muted)]">
        …
      </main>
    );
  }

  return (
    <main className="page flex min-h-[70vh] flex-col justify-center py-10">
      <AuthForm initialMode={mode} next={next.startsWith("/") ? next : "/discover"} />
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="page flex min-h-[60vh] items-center justify-center text-[var(--sn-muted)]">
          …
        </main>
      }
    >
      <HomeInner />
    </Suspense>
  );
}
