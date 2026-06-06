"use client";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { MONO, fmtCAD } from "@/lib/format";
import type { Violation } from "@/lib/types";

const SEV = {
  critical: { label: "Critique", color: "#ff4d6d", bg: "#200a10", border: "#3a1520", left: "#ff4d6d" },
  high:     { label: "Élevé",    color: "#f5a623", bg: "#1a1200", border: "#3a2800", left: "#f5a623" },
  medium:   { label: "Moyen",    color: "#5a7aff", bg: "#0a0e20", border: "#1a2040", left: "#5a7aff" },
  low:      { label: "Faible",   color: "#3A4A6A", bg: "#0F1A2E", border: "#1a2236", left: "#1a2236" },
};

interface ViolationCardProps {
  v: Violation;
  onRequestApproval: (v: Violation) => void;
  onResolve: (id: number, status: string) => void;
  isRequesting?: boolean;
}

export function ViolationCard({ v, onRequestApproval, onResolve, isRequesting }: ViolationCardProps) {
  const cfg = SEV[v.severity] ?? SEV.low;
  const t = v.transaction;

  return (
    <div style={{
      background: "#0B1120", border: "1px solid #1a2236",
      borderLeft: `3px solid ${cfg.left}`, borderRadius: "0 8px 8px 0", padding: "14px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 4, padding: "2px 7px" }}>
          {cfg.label}
        </span>
        <span style={{ fontSize: 10, fontFamily: MONO, background: "#0F1A2E", color: "#3A4A6A", border: "1px solid #1a2236", borderRadius: 4, padding: "2px 7px" }}>
          ouverte
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#E8EDF5" }}>{t.merchant_name}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: cfg.color, fontFamily: MONO }}>{fmtCAD(t.amount_cad)}</span>
        <span style={{ fontSize: 11, color: "#3A4A6A", fontFamily: MONO }}>— Carte {t.transaction_code}</span>
        <Link href={`/transactions?id=${t.id}`} style={{ marginLeft: "auto", fontSize: 11, color: "#3b6aff", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
          Voir transaction <ExternalLink size={11} />
        </Link>
      </div>
      <p style={{ fontSize: 13, fontWeight: 500, color: "#C8D3E5", marginBottom: 4 }}>
        {v.rule?.description_fr ?? v.rule?.rule_code}
      </p>
      <p style={{ fontSize: 12, color: "#4A5A7A", lineHeight: 1.6, marginBottom: 12 }}>
        {v.ai_explanation}
      </p>
      {v.status === "open" && (
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: isRequesting ? "Analyse IA en cours..." : "Demander une approbation", onClick: () => !isRequesting && onRequestApproval(v), color: "#3b6aff", bg: "#0a1220", border: "#1a2a40", disabled: !!isRequesting },
            { label: "Marquer résolu", onClick: () => onResolve(v.id, "resolved"), color: "#3A4A6A", bg: "transparent", border: "#1a2236" },
            { label: "Faux positif", onClick: () => onResolve(v.id, "dismissed"), color: "#3A4A6A", bg: "transparent", border: "#1a2236" },
          ].map(btn => (
            <button key={btn.label} onClick={btn.onClick} disabled={btn.disabled} style={{
              fontSize: 11, padding: "5px 14px", borderRadius: 6,
              background: btn.bg, color: btn.color, border: `1px solid ${btn.border}`,
              cursor: btn.disabled ? "not-allowed" : "pointer",
              opacity: btn.disabled ? 0.7 : 1,
              fontFamily: "Inter, sans-serif",
            }}>{btn.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
