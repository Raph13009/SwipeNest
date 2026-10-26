"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, Fingerprint, Heart, Map, Search, Settings, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
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
  { href: "/settings", icon: Settings, key: "settings" },
] as const;

export function DesktopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const clearSessionState = useAppStore((s) => s.clearSessionState);
  const { user, signOut, signInWithGoogle } = useAuth();
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

  const logout = async () => {
    await signOut();
    clearSessionState();
    router.push("/");
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-[rgba(27,77,62,0.08)] bg-[rgba(255,253,249,0.8)] p-6 backdrop-blur lg:flex">
      <Logo className="mb-10" />
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

      <div className="mt-auto space-y-3 border-t border-[rgba(27,77,62,0.08)] pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sn-muted)]">
          {t(messages, "nav.account")}
        </p>
        {user ? (
          <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              {user.user_metadata?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.user_metadata.avatar_url}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sn-sage)]/40 text-xs font-bold text-[var(--sn-green)]">
                  {(user.email?.[0] || "?").toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--sn-ink)]">
                  {user.user_metadata?.full_name ||
                    user.user_metadata?.name ||
                    user.email}
                </p>
                <p className="truncate text-[11px] text-[var(--sn-muted)]">{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[var(--sn-muted)] transition hover:bg-[var(--sn-beige)] hover:text-[var(--sn-green)]"
            >
              <LogOut size={14} />
              {t(messages, "settings.signOut")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => signInWithGoogle("/settings")}
            className="sn-btn sn-btn-primary w-full text-xs"
          >
            {t(messages, "settings.signInGoogle")}
          </button>
        )}
      </div>
    </aside>
  );
}
