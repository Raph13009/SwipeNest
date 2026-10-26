"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DnaRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/discover");
  }, [router]);
  return null;
}
