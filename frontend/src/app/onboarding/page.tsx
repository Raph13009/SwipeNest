"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Onboarding is skipped — prefs live in Settings. */
export default function OnboardingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/discover");
  }, [router]);
  return (
    <main className="page flex min-h-[50vh] items-center justify-center text-[var(--sn-muted)]">
      …
    </main>
  );
}
