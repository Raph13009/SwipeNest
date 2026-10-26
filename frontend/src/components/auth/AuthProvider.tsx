"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { setApiUserId } from "@/lib/api";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncProfile(user: User) {
  const supabase = createClient();
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      display_name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        null,
      avatar_url: user.user_metadata?.avatar_url || null,
    },
    { onConflict: "id" }
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) {
      setApiUserId(null);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setApiUserId(data.user?.id ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setApiUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    if (data.user) {
      setUser(data.user);
      setApiUserId(data.user.id);
      await syncProfile(data.user);
    }
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    if (data.session?.user) {
      setUser(data.session.user);
      setApiUserId(data.session.user.id);
      await syncProfile(data.session.user);
      return;
    }
    // Autoconfirm off fallback: try immediate sign-in
    const signed = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signed.error) throw signed.error;
    if (signed.data.user) {
      setUser(signed.data.user);
      setApiUserId(signed.data.user.id);
      await syncProfile(signed.data.user);
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setApiUserId(null);
    setUser(null);
    try {
      localStorage.removeItem("swipenest-ui");
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      configured,
      signInWithPassword,
      signUpWithPassword,
      signOut,
    }),
    [user, loading, configured, signInWithPassword, signUpWithPassword, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
