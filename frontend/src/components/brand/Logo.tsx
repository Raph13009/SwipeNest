"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = 28,
  wordmark = true,
}: {
  className?: string;
  size?: number;
  wordmark?: boolean;
}) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2", className)}>
      <Image src="/brand/logo.svg" alt="SwipeNest AI" width={size} height={size} priority />
      {wordmark && (
        <span className="text-[1.15rem] font-bold tracking-tight text-[var(--sn-green)]">
          SwipeNest
          <sup className="ml-0.5 text-[0.65em] font-semibold text-[var(--sn-sage)]">AI</sup>
        </span>
      )}
    </Link>
  );
}
