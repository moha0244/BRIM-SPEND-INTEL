// src/components/ui/Badge.tsx
// Badges de statut et sévérité réutilisables

import type { Severity, AIRecommendation, ReportStatus } from "@/lib/types";
import { MONO } from "@/lib/format";

interface BadgeProps {
  label?: string;
  style?: React.CSSProperties;
}

function BaseBadge({
  label,
  color,
  bg,
  border,
}: { label: string; color: string; bg: string; border: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontFamily: MONO,
        fontWeight: 500,
        padding: "3px 8px",
        borderRadius: 4,
        background: bg,
        color,
        border: `1px solid ${border}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ─── Sévérité ─────────────────────────────────────────────────────────────────

export const SEV_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string; leftBorder: string }> = {
  critical: { label: "Critique", color: "#ff4d6d", bg: "#200a10", border: "#3a1520", leftBorder: "#ff4d6d" },
  high:     { label: "Élevé",    color: "#f5a623", bg: "#1a1200", border: "#3a2800", leftBorder: "#f5a623" },
  medium:   { label: "Moyen",    color: "#5a7aff", bg: "#0a0e20", border: "#1a2040", leftBorder: "#5a7aff" },
  low:      { label: "Faible",   color: "#3A4A6A", bg: "#0F1A2E", border: "#1a2236", leftBorder: "#1a2236" },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEV_CONFIG[severity] ?? SEV_CONFIG.low;
  return <BaseBadge label={cfg.label} color={cfg.color} bg={cfg.bg} border={cfg.border} />;
}

// ─── Conformité ───────────────────────────────────────────────────────────────

export function ComplianceBadge({ status }: { status: string }) {
  if (status === "violation" || status === "flagged") {
    return <BaseBadge label="violation" color="#ff4d6d" bg="#200a10" border="#3a1520" />;
  }
  if (status === "pending") {
    return <BaseBadge label="en attente" color="#f5a623" bg="#1a1200" border="#3a2800" />;
  }
  return <BaseBadge label="conforme" color="#00c97e" bg="#001f12" border="#003d22" />;
}

// ─── Statut générique (ouvert/résolu/rejeté) ──────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string; border: string }> = {
    open:      { label: "ouverte",    color: "#f5a623", bg: "#1a1200", border: "#3a2800" },
    resolved:  { label: "résolu",     color: "#00c97e", bg: "#001f12", border: "#003d22" },
    dismissed: { label: "rejeté",     color: "#3A4A6A", bg: "#0F1A2E", border: "#1a2236" },
    pending:   { label: "en attente", color: "#f5a623", bg: "#1a1200", border: "#3a2800" },
    approved:  { label: "approuvée",  color: "#00c97e", bg: "#001f12", border: "#003d22" },
    rejected:  { label: "refusée",    color: "#ff4d6d", bg: "#200a10", border: "#3a1520" },
  };
  const c = cfg[status] ?? { label: status, color: "#3A4A6A", bg: "#0F1A2E", border: "#1a2236" };
  return <BaseBadge label={c.label} color={c.color} bg={c.bg} border={c.border} />;
}

// ─── Recommandation IA ────────────────────────────────────────────────────────

export function RecoBadge({ reco }: { reco: AIRecommendation | null }) {
  const cfg = {
    Approuver: { color: "#00c97e", bg: "#001f12", border: "#003d22" },
    Refuser:   { color: "#ff4d6d", bg: "#200a10", border: "#3a1520" },
    Prudence:  { color: "#f5a623", bg: "#1a1200", border: "#3a2800" },
  }[reco ?? "Prudence"] ?? { color: "#f5a623", bg: "#1a1200", border: "#3a2800" };

  return (
    <BaseBadge
      label={`Reco : ${reco ?? "Prudence"}`}
      color={cfg.color}
      bg={cfg.bg}
      border={cfg.border}
    />
  );
}

// ─── Statut rapport ───────────────────────────────────────────────────────────

export const REPORT_STATUS_CFG: Record<ReportStatus, { label: string; color: string; bg: string; border: string }> = {
  draft:       { label: "Brouillon",      color: "#3A4A6A", bg: "#0F1A2E", border: "#1a2236" },
  pending_cfo: { label: "En attente CFO", color: "#f5a623", bg: "#1a1200", border: "#3a2800" },
  approved:    { label: "Approuvé",       color: "#00c97e", bg: "#001f12", border: "#003d22" },
  rejected:    { label: "Refusé",         color: "#ff4d6d", bg: "#200a10", border: "#3a1520" },
};

export function ReportStatusBadge({ status }: { status: ReportStatus | string }) {
  const cfg = REPORT_STATUS_CFG[status as ReportStatus] ?? REPORT_STATUS_CFG.draft;
  return <BaseBadge label={cfg.label} color={cfg.color} bg={cfg.bg} border={cfg.border} />;
}
