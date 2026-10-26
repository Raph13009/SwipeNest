"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAppStore } from "@/store/useAppStore";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const hydrated = useAppStore((s) => s.hydrated);
  const router = useRouter();

  useEffect(() => {
    if (!loading && hydrated && !user) {
      router.replace("/");
    }
  }, [loading, hydrated, user, router]);

  if (loading || !hydrated) {
    return (
      <main className="page flex min-h-[50vh] items-center justify-center text-[var(--sn-muted)]">
        …
      </main>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
