// src/components/transactions/TxTable.tsx
"use client";

import { RefObject } from "react";
import { fmtCAD, MONO } from "@/lib/format";
import { ComplianceBadge } from "@/components/ui/Badge";
import type { Transaction } from "@/lib/types";

const HEADERS = ["Date", "Marchand", "Carte", "Montant", "MCC", "Conformité", "Approbation", "Rapport"];

interface TxTableProps {
  transactions: Transaction[];
  selected: Transaction | null;
  highlightId: number | null;
  highlightRowRef: RefObject<HTMLTableRowElement | null>;
  onSelect: (t: Transaction | null) => void;
}

export function TxTable({ transactions, selected, highlightId, highlightRowRef, onSelect }: TxTableProps) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead style={{ position: "sticky", top: 0, background: "#080C12", zIndex: 1 }}>
        <tr style={{ borderBottom: "1px solid #1a2236" }}>
          {HEADERS.map(h => (
            <th key={h} style={{
              textAlign: h === "Montant" ? "right" : "left",
              padding: "10px 16px", fontSize: 9, color: "#2A3A55",
              fontWeight: 400, fontFamily: MONO,
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {transactions.map(t => {
          const active = selected?.id === t.id;
          const highlighted = t.id === highlightId;
          return (
            <tr
              key={t.id}
              ref={highlighted ? highlightRowRef : null}
              onClick={() => onSelect(active ? null : t)}
              style={{
                borderBottom: "1px solid #0f1520",
                cursor: "pointer",
                background: active ? "#0F1A2E" : highlighted ? "#0a1a10" : "transparent",
                borderLeft: highlighted ? "2px solid #00c97e" : "2px solid transparent",
                transition: "background 0.1s",
              }}
            >
              <td style={{ padding: "10px 16px", fontSize: 12, color: "#4A5A7A", fontFamily: MONO, whiteSpace: "nowrap" }}>
                {t.date}
              </td>
              <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 500, color: "#E8EDF5", maxWidth: 200 }}>
                {t.merchant}
              </td>
              <td style={{ padding: "10px 16px", fontSize: 11, color: "#4A5A7A", fontFamily: MONO }}>
                {t.transaction_code}
              </td>
              <td style={{ padding: "10px 16px", fontSize: 12, color: "#E8EDF5", fontFamily: MONO, textAlign: "right", whiteSpace: "nowrap" }}>
                {fmtCAD(t.amount)}
              </td>
              <td style={{ padding: "10px 16px", fontSize: 11, color: "#4A5A7A", whiteSpace: "nowrap" }}>
                <span style={{ fontFamily: MONO, color: "#2A3A55", marginRight: 6 }}>{t.mcc}</span>
                {t.mcc_label}
              </td>
              <td style={{ padding: "10px 16px" }}>
                <ComplianceBadge status={t.compliance_status} />
              </td>
              <td style={{ padding: "10px 16px" }}>
                {t.approval_status === "approved" ? (
                  <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 500, padding: "3px 8px", borderRadius: 4, background: "#001f12", color: "#00c97e", border: "1px solid #003d22" }}>approuvé</span>
                ) : t.approval_status === "rejected" ? (
                  <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 500, padding: "3px 8px", borderRadius: 4, background: "#200a10", color: "#ff4d6d", border: "1px solid #3a1520" }}>refusé</span>
                ) : t.approval_status === "pending_approval" ? (
                  <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 500, padding: "3px 8px", borderRadius: 4, background: "#1a1200", color: "#f5a623", border: "1px solid #3a2800" }}>en attente</span>
                ) : (
                  <span style={{ fontSize: 11, color: "#2A3A55" }}>—</span>
                )}
              </td>
              <td style={{ padding: "10px 16px", fontSize: 11, color: t.report ? "#5a7aff" : "#2A3A55", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.report?.report_name ?? "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
