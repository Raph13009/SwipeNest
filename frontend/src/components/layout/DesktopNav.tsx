"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, Heart, LogOut, Map, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
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

export function DesktopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const clearSessionState = useAppStore((s) => s.clearSessionState);
  const { user, loading, signOut } = useAuth();
  const messages = getMessages(locale);

  if (loading || !user || pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return null;
  }

  const logout = async () => {
    await signOut();
    clearSessionState();
    router.push("/");
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-[rgba(27,77,62,0.08)] bg-[rgba(255,253,249,0.8)] p-5 backdrop-blur lg:flex">
      <Logo className="mb-8" />
      <nav className="flex flex-1 flex-col gap-1">
        {items.map(({ href, icon: Icon, key }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                active
                  ? "bg-[rgba(167,196,184,0.35)] text-[var(--sn-green)]"
                  : "text-[var(--sn-muted)] hover:bg-white hover:text-[var(--sn-green)]"
              )}
            >
              <Icon size={18} />
              {t(messages, `nav.${key}`)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[rgba(27,77,62,0.08)] pt-4">
        <p className="truncate text-sm font-semibold text-[var(--sn-ink)]">
          {user.email}
        </p>
        <button
          type="button"
          onClick={logout}
          className="mt-2 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-xs font-bold text-[var(--sn-muted)] transition hover:text-[var(--sn-green)]"
        >
          <LogOut size={14} />
          {t(messages, "settings.signOut")}
        </button>
      </div>
    </aside>
  );
}
