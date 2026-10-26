"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, Map, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMessages, t } from "@/lib/i18n";
import { useAppStore } from "@/store/useAppStore";
import { useAuth } from "@/components/auth/AuthProvider";

const items = [
  { href: "/discover", icon: Compass, key: "discover" },
  { href: "/favorites", icon: Heart, key: "saved" },
  { href: "/map", icon: Map, key: "map" },
  { href: "/settings", icon: UserRound, key: "account" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const locale = useAppStore((s) => s.locale);
  const { user, loading } = useAuth();
  const messages = getMessages(locale);

  if (loading || !user || pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[rgba(27,77,62,0.08)] bg-[rgba(248,246,241,0.94)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "max(8px, var(--safe-bottom))" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 pt-1.5">
        {items.map(({ href, icon: Icon, key }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] font-semibold",
                  active ? "text-[var(--sn-green)]" : "text-[var(--sn-muted)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    active && "bg-[rgba(167,196,184,0.35)]"
                  )}
                >
                  <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                </span>
                {t(messages, `nav.${key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
