// src/components/reports/ReportDetail.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { fmtCAD, fmtDate, MONO } from "@/lib/format";
import { Pagination } from "@/components/ui/Pagination";
import type { Report, ReportStatus } from "@/lib/types";

interface ReportTransaction {
  id: number;
  merchant_name: string;
  transaction_date: string;
  amount_cad: number;
  mcc_label: string;
}

interface ViolationSummary {
  transaction_id: number;
  severity: string;
  ai_explanation: string;
}

const STATUS_CFG: Record<ReportStatus, { label: string; color: string; bg: string; border: string }> = {
  draft:       { label: "Brouillon",      color: "#3A4A6A", bg: "#0F1A2E", border: "#1a2236" },
  pending_cfo: { label: "En attente CFO", color: "#f5a623", bg: "#1a1200", border: "#3a2800" },
  approved:    { label: "Approuvé",       color: "#00c97e", bg: "#001f12", border: "#003d22" },
  rejected:    { label: "Refusé",         color: "#ff4d6d", bg: "#200a10", border: "#3a1520" },
};

const TX_PER_PAGE = 50;

export function ReportDetail({ reportId }: { reportId: number }) {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [transactions, setTransactions] = useState<ReportTransaction[]>([]);
  const [violations, setViolations] = useState<ViolationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);

  useEffect(() => {
    fetch(`/api/reports?id=${reportId}`)
      .then(r => r.json())
      .then(data => {
        setReport(data.report);
        setTransactions(data.transactions ?? []);
        setViolations(data.violations ?? []);
        setLoading(false);
      });
  }, [reportId]);

  async function submit() {
    await fetch("/api/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reportId, status: "pending_cfo" }),
    });
    setReport(r => r ? { ...r, status: "pending_cfo" } : r);
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "#3A4A6A" }}>
      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!report) return null;

  const cfg = STATUS_CFG[report.status] ?? STATUS_CFG.draft;
  const violationIds = new Set(violations.map(v => v.transaction_id));

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
      <button onClick={() => router.push("/reports")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#3A4A6A", cursor: "pointer", fontSize: 12, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={14} /> Retour aux rapports
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: "#E8EDF5", margin: 0 }}>{report.report_name}</h1>
        <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 600, padding: "3px 8px", borderRadius: 4, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
          {cfg.label}
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          ["Période", `${fmtDate(report.date_start)} — ${fmtDate(report.date_end)}`],
          ["Montant total", fmtCAD(report.total_amount_cad)],
          ["Transactions", String(transactions.length)],
          ["Violations", String(violations.length)],
        ].map(([label, value]) => (
          <div key={label} style={{ background: "#0B1120", border: "1px solid #1a2236", borderRadius: 8, padding: "12px 14px" }}>
            <p style={{ fontSize: 9, color: "#3A4A6A", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 13, fontWeight: 500, fontFamily: MONO, color: label === "Violations" && violations.length > 0 ? "#ff4d6d" : "#E8EDF5" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Transactions */}
      {(() => {
        const totalPages = Math.ceil(transactions.length / TX_PER_PAGE);
        const paginated = transactions.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE);
        return (
          <div style={{ background: "#0B1120", border: "1px solid #1a2236", borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>
            <p style={{ padding: "12px 16px", fontSize: 9, color: "#3A4A6A", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "1px solid #1a2236", margin: 0 }}>
              Transactions incluses ({transactions.length})
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Date", "Marchand", "Catégorie", "Montant", "Conformité"].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 3 ? "right" : "left", padding: "8px 16px", fontSize: 9, color: "#2A3A55", fontWeight: 400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #1a2236" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(t => {
                  const hasViolation = violationIds.has(t.id);
                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid #0f1520" }}>
                      <td style={{ padding: "9px 16px", fontSize: 11, color: "#4A5A7A", fontFamily: MONO }}>{t.transaction_date?.slice(0, 10)}</td>
                      <td style={{ padding: "9px 16px", fontSize: 12, fontWeight: 500, color: "#E8EDF5" }}>{t.merchant_name}</td>
                      <td style={{ padding: "9px 16px", fontSize: 11, color: "#4A5A7A" }}>{t.mcc_label}</td>
                      <td style={{ padding: "9px 16px", fontSize: 12, color: "#E8EDF5", fontFamily: MONO, textAlign: "right" }}>{fmtCAD(t.amount_cad)}</td>
                      <td style={{ padding: "9px 16px" }}>
                        <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 500, padding: "2px 7px", borderRadius: 4, background: hasViolation ? "#200a10" : "#001f12", color: hasViolation ? "#ff4d6d" : "#00c97e", border: `1px solid ${hasViolation ? "#3a1520" : "#003d22"}` }}>
                          {hasViolation ? "violation" : "conforme"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              page={txPage}
              totalPages={totalPages}
              total={transactions.length}
              perPage={TX_PER_PAGE}
              onChange={setTxPage}
            />
          </div>
        );
      })()}

      {/* Reco CFO */}
      {report.ai_summary && (
        <div style={{ background: "#0B1120", border: "1px solid #1a2236", borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 9, color: "#2A3A55", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            Recommandation IA pour le CFO
          </p>
          <p style={{ fontSize: 13, color: "#C8D3E5", lineHeight: 1.7 }}>
            {report.ai_summary.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={i} style={{ color: "#E8EDF5" }}>{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        </div>
      )}

      {report.status === "draft" && (
        <button onClick={submit} style={{ padding: "10px 24px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "#3b6aff", color: "#fff", border: "none", cursor: "pointer" }}>
          Soumettre au CFO
        </button>
      )}
    </div>
  );
}
