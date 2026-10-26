import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRent(eur: number, locale: string = "en") {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-EU", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(eur);
}

export function arrLabel(n: number, locale: string = "en") {
  if (locale === "fr") return `Paris ${n}e`;
  const ordinal =
    n % 10 === 1 && n !== 11
      ? "st"
      : n % 10 === 2 && n !== 12
        ? "nd"
        : n % 10 === 3 && n !== 13
          ? "rd"
          : "th";
  return `Paris ${n}${ordinal}`;
}
