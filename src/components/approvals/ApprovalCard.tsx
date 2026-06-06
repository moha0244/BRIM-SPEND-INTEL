// src/components/approvals/ApprovalCard.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Check, X } from "lucide-react";
import { RecoBadge } from "@/components/ui/Badge";
import { fmtCAD, fmtDate, MONO } from "@/lib/format";
import type { ApprovalRequest, AIRecommendation } from "@/lib/types";

interface ApprovalCardProps {
  req: ApprovalRequest;
  onDecide: (id: number, decision: string) => Promise<void>;
}

export function ApprovalCard({ req, onDecide }: ApprovalCardProps) {
  const [deciding, setDeciding] = useState<string | null>(null);
  const t = req.transaction;
  const isPending = !req.decision || req.decision === "pending";

  const statusLabel = isPending ? "en attente"
    : req.decision === "approved" ? "approuvée" : "refusée";
  const statusColor = isPending ? "#f5a623"
    : req.decision === "approved" ? "#00c97e" : "#ff4d6d";
  const statusBg = isPending ? "#1a1200"
    : req.decision === "approved" ? "#001f12" : "#200a10";
  const statusBorder = isPending ? "#3a2800"
    : req.decision === "approved" ? "#003d22" : "#3a1520";

  async function handle(decision: string) {
    setDeciding(decision);
    await onDecide(req.id, decision);
    setDeciding(null);
  }

  return (
    <div style={{
      background: "#0B1120", border: "1px solid #1a2236",
      borderRadius: 10, padding: "16px 20px",
      opacity: isPending ? 1 : 0.6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontFamily: MONO, background: statusBg, color: statusColor, border: `1px solid ${statusBorder}`, borderRadius: 4, padding: "2px 7px" }}>
          {statusLabel}
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#E8EDF5" }}>{t.merchant_name}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#00c97e", fontFamily: MONO }}>{fmtCAD(t.amount_cad)}</span>
        <span style={{ fontSize: 11, color: "#3A4A6A", fontFamily: MONO }}>
          {fmtDate(t.transaction_date)} — Carte {t.transaction_code}
        </span>
        <Link href={`/transactions?id=${t.id}`} style={{ marginLeft: "auto", fontSize: 11, color: "#3b6aff", textDecoration: "none" }}>
          Détails →
        </Link>
      </div>

      {req.ai_reasoning && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 9, color: "#2A3A55", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Contexte IA
          </p>
          <p style={{ fontSize: 12, color: "#8A9AB8", lineHeight: 1.6 }}>{req.ai_reasoning}</p>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <RecoBadge reco={req.ai_recommendation as AIRecommendation | null} />
        {isPending && (
          <>
            <button onClick={() => handle("approved")} disabled={!!deciding} style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, padding: "6px 16px", borderRadius: 6,
              background: "#001f12", color: "#00c97e", border: "1px solid #003d22",
              cursor: "pointer", opacity: deciding ? 0.6 : 1,
            }}>
              {deciding === "approved" ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={12} />}
              Approuver
            </button>
            <button onClick={() => handle("rejected")} disabled={!!deciding} style={{
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, padding: "6px 16px", borderRadius: 6,
              background: "#200a10", color: "#ff4d6d", border: "1px solid #3a1520",
              cursor: "pointer", opacity: deciding ? 0.6 : 1,
            }}>
              {deciding === "rejected" ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <X size={12} />}
              Refuser
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
