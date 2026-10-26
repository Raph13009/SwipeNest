"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  useEffect(() => {
    router.replace(next ? `/?next=${encodeURIComponent(next)}` : "/");
  }, [router, next]);

  return (
    <main className="page flex min-h-[50vh] items-center justify-center text-[var(--sn-muted)]">
      …
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
      <LoginRedirect />
    </Suspense>
  );
}
