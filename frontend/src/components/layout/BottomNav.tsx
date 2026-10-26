"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Fingerprint, Heart, Map, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMessages, t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/components/auth/AuthProvider";

const items = [
  { href: "/discover", icon: Compass, key: "discover" },
  { href: "/search", icon: Search, key: "search" },
  { href: "/dna", icon: Fingerprint, key: "dna" },
  { href: "/favorites", icon: Heart, key: "saved" },
  { href: "/map", icon: Map, key: "map" },
  { href: "/settings", icon: UserRound, key: "account" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const locale = useAppStore((s) => s.locale);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const { user } = useAuth();
  const messages = getMessages(locale);

  if (
    !onboardingComplete ||
    pathname.startsWith("/onboarding") ||
    pathname === "/" ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth")
  ) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[rgba(27,77,62,0.08)] bg-[rgba(248,246,241,0.94)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "max(8px, var(--safe-bottom))" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-0.5 pt-1.5">
        {items.map(({ href, icon: Icon, key }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const label =
            key === "account"
              ? user
                ? t(messages, "nav.account")
                : t(messages, "nav.account")
              : t(messages, `nav.${key}`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 text-[9px] font-semibold sm:text-[10px]",
                  active ? "text-[var(--sn-green)]" : "text-[var(--sn-muted)]"
                )}
              >
                <span
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full",
                    active && "bg-[rgba(167,196,184,0.35)]"
                  )}
                >
                  {key === "account" && user?.user_metadata?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.user_metadata.avatar_url}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
