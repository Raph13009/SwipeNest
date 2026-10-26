import type { UserPreferences } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

export type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  preferences: Partial<UserPreferences> | Record<string, unknown>;
  onboarding_complete: boolean;
};

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,display_name,avatar_url,preferences,onboarding_complete")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function saveProfileState(input: {
  userId: string;
  preferences: UserPreferences;
  onboardingComplete: boolean;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").upsert(
    {
      id: input.userId,
      email: input.email ?? null,
      display_name: input.displayName ?? null,
      avatar_url: input.avatarUrl ?? null,
      preferences: input.preferences,
      onboarding_complete: input.onboardingComplete,
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}
