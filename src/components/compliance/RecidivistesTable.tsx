// src/components/compliance/RecidivistesTable.tsx
"use client";

import { fmtCAD, MONO } from "@/lib/format";
import type { Violation } from "@/lib/types";

interface RecidivistesTableProps {
  violations: Violation[];
}

export function RecidivistesTable({ violations }: RecidivistesTableProps) {
  const byCard = violations
    .filter(v => v.status === "open")
    .reduce((acc, v) => {
      const code = v.transaction.transaction_code;
      if (!acc[code]) acc[code] = { code, count: 0, total: 0 };
      acc[code].count++;
      acc[code].total += v.transaction.amount_cad;
      return acc;
    }, {} as Record<number, { code: number; count: number; total: number }>);

  const sorted = Object.values(byCard).sort((a, b) => b.count - a.count).slice(0, 5);
  if (!sorted.length) return null;

  return (
    <div style={{ background: "#0B1120", border: "1px solid #1a2236", borderRadius: 10, padding: "16px 18px" }}>
      <p style={{ fontSize: 9, color: "#2A3A55", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>
        Récidivistes — Cartes avec le plus de violations
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #1a2236" }}>
            {["Carte", "Violations", "Montant total"].map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 16px", fontSize: 9, color: "#2A3A55", fontWeight: 400, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(c => (
            <tr key={c.code} style={{ borderBottom: "1px solid #0f1520" }}>
              <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 500, color: "#E8EDF5", fontFamily: MONO }}>Carte {c.code}</td>
              <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600, color: "#ff4d6d", fontFamily: MONO }}>{c.count}</td>
              <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, color: "#E8EDF5", fontFamily: MONO }}>{fmtCAD(c.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
