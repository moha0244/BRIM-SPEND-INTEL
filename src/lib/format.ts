// src/lib/format.ts
// Fonctions de formatage partagées

export const MONO = "'IBM Plex Mono', monospace";

export function fmtCAD(n: number, compact = false) {
  if (compact && n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M $`;
  if (compact && n >= 1_000) return `${(n / 1_000).toFixed(0)}k $`;
  return (
    new Intl.NumberFormat("fr-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " $"
  );
}

export function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateShort(s: string) {
  return s?.slice(0, 10) ?? "—";
}

export function fmtTime(d: Date) {
  return d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}
