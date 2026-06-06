"use client";
import { X, ChevronRight } from "lucide-react";
import { MONO, fmtCAD } from "@/lib/format";
import type { Transaction } from "@/lib/types";

function StatusBadge({ status }: { status: string }) {
  const isViolation = status === "violation" || status === "flagged";
  const isPending = status === "pending";
  return (
    <span style={{
      fontSize: 10, fontFamily: MONO, fontWeight: 500, padding: "3px 8px", borderRadius: 4,
      background: isViolation ? "#200a10" : isPending ? "#1a1200" : "#001f12",
      color: isViolation ? "#ff4d6d" : isPending ? "#f5a623" : "#00c97e",
      border: `1px solid ${isViolation ? "#3a1520" : isPending ? "#3a2800" : "#003d22"}`,
    }}>
      {isViolation ? "violation" : isPending ? "en attente" : "conforme"}
    </span>
  );
}

export function TxDrawer({ t, onClose }: { t: Transaction; onClose: () => void }) {
  return (
    <div style={{
      width: 320, background: "#0B1120", borderLeft: "1px solid #1a2236",
      display: "flex", flexDirection: "column", flexShrink: 0, height: "100%", overflowY: "auto",
    }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #1a2236", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 9, color: "#3A4A6A", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em" }}>tx-{t.id}</p>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#E8EDF5", marginTop: 2 }}>{t.merchant}</p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#3A4A6A", padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Détails */}
        <div>
          <p style={{ fontSize: 9, color: "#2A3A55", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Détails</p>
          {[
            ["Marchand", t.merchant],
            ["Date", t.date],
            ["Montant", fmtCAD(t.amount)],
            ["Carte", t.card_label || String(t.transaction_code)],
            ["MCC", `${t.mcc} — ${t.mcc_label}`],
            ["Ville", t.city || "—"],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #0f1520" }}>
              <span style={{ fontSize: 11, color: "#3A4A6A", fontFamily: MONO }}>{label}</span>
              <span style={{ fontSize: 11, color: "#E8EDF5", textAlign: "right", maxWidth: 180 }}>{value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
            <span style={{ fontSize: 11, color: "#3A4A6A", fontFamily: MONO }}>Conformité</span>
            <StatusBadge status={t.compliance_status} />
          </div>
        </div>

        {/* Analyse IA */}
        <div style={{ background: "#080C12", border: "1px solid #1a2236", borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ fontSize: 9, color: "#2A3A55", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Analyse IA — Conformité</p>
          {t.violation ? (
            <div>
              <span style={{
                fontSize: 9, fontFamily: MONO, fontWeight: 600, padding: "2px 6px", borderRadius: 3, textTransform: "uppercase",
                background: t.violation.severity === "critical" ? "#200a10" : "#1a1200",
                color: t.violation.severity === "critical" ? "#ff4d6d" : "#f5a623",
                border: `1px solid ${t.violation.severity === "critical" ? "#3a1520" : "#3a2800"}`,
                display: "inline-block", marginBottom: 6,
              }}>{t.violation.severity}</span>
              <p style={{ fontSize: 12, color: "#C8D3E5", lineHeight: 1.6 }}>{t.violation.ai_explanation}</p>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: t.compliance_status === "pending" ? "#f5a623" : "#00c97e", lineHeight: 1.6 }}>
              {t.compliance_status === "pending" ? "Transaction en attente d'approbation." : "Transaction conforme. Aucune violation détectée."}
            </p>
          )}
        </div>

        {/* Rapport */}
        <div style={{ background: "#080C12", border: "1px solid #1a2236", borderRadius: 8, padding: "12px 14px" }}>
          <p style={{ fontSize: 9, color: "#2A3A55", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Rapport</p>
          {t.report ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 12, color: "#5a7aff" }}>{t.report.report_name}</p>
              <ChevronRight size={14} style={{ color: "#3A4A6A" }} />
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "#3A4A6A" }}>—</p>
          )}
        </div>
      </div>
    </div>
  );
}
