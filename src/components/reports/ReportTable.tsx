// src/components/reports/ReportTable.tsx
"use client";

import { useRouter } from "next/navigation";
import { fmtCAD, MONO } from "@/lib/format";
import type { Report, ReportStatus } from "@/lib/types";

const STATUS_CFG: Record<ReportStatus, { label: string; color: string; bg: string; border: string }> = {
  draft:       { label: "Brouillon",      color: "#3A4A6A", bg: "#0F1A2E", border: "#1a2236" },
  pending_cfo: { label: "En attente CFO", color: "#f5a623", bg: "#1a1200", border: "#3a2800" },
  approved:    { label: "Approuvé",       color: "#00c97e", bg: "#001f12", border: "#003d22" },
  rejected:    { label: "Refusé",         color: "#ff4d6d", bg: "#200a10", border: "#3a1520" },
};

interface ReportTableProps {
  reports: Report[];
}

export function ReportTable({ reports }: ReportTableProps) {
  const router = useRouter();
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid #1a2236" }}>
          {["Nom", "Période", "# Tx", "Montant", "Violations", "Statut"].map((h) => (
            <th key={h} style={{
              textAlign: "left", padding: "10px 16px",
              fontSize: 9, color: "#2A3A55", fontWeight: 400,
              fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em",
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {reports.map((r) => {
          const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.draft;
          return (
            <tr
              key={r.id}
              onClick={() => router.push(`/reports/${r.id}`)}
              style={{ borderBottom: "1px solid #0f1520", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#0B1120")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 500, color: "#E8EDF5" }}>
                {r.report_name}
              </td>
              <td style={{ padding: "12px 16px", fontSize: 11, color: "#4A5A7A", fontFamily: MONO }}>
                {r.date_start} — {r.date_end}
              </td>
              <td style={{ padding: "12px 16px", fontSize: 12, color: "#4A5A7A", fontFamily: MONO }}>
                —
              </td>
              <td style={{ padding: "12px 16px", fontSize: 12, color: "#E8EDF5", fontFamily: MONO }}>
                {fmtCAD(r.total_amount_cad)}
              </td>
              <td style={{ padding: "12px 16px", fontSize: 12, color: "#4A5A7A", fontFamily: MONO }}>
                —
              </td>
              <td style={{ padding: "12px 16px" }}>
                <span style={{
                  fontSize: 10, fontFamily: MONO, fontWeight: 500,
                  padding: "3px 8px", borderRadius: 4,
                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                }}>
                  {cfg.label}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
