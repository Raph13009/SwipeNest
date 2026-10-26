import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

export type Locale = "en" | "fr";
export type Messages = typeof en;

const catalogs: Record<Locale, Messages> = { en, fr };

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] || en;
}

export function t(
  messages: Messages,
  path: string,
  fallback?: string
): string {
  const parts = path.split(".");
  let cur: unknown = messages;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return fallback ?? path;
    }
  }
  return typeof cur === "string" ? cur : fallback ?? path;
}
