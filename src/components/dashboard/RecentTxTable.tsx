import Link from "next/link";
import { MONO, fmtCAD } from "@/lib/format";

interface TxRow {
  id: number;
  transaction_code: number;
  date: string;
  merchant: string;
  amount: number;
  compliance_status: string;
}

export function RecentTxTable({ rows }: { rows: TxRow[] }) {
  return (
    <div style={{ background: "#0B1120", border: "1px solid #1a2236", borderRadius: 10 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", borderBottom: "1px solid #1a2236",
      }}>
        <p style={{ fontSize: 9, color: "#3A4A6A", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO }}>
          Transactions récentes
        </p>
        <Link href="/transactions" style={{ fontSize: 11, color: "#3b6aff", textDecoration: "none", fontFamily: MONO }}>
          Voir tout →
        </Link>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Date", "Marchand", "Carte", "Montant", "Conformité"].map((h) => (
              <th key={h} style={{
                textAlign: h === "Montant" ? "right" : "left",
                padding: "10px 18px", fontSize: 9, color: "#2A3A55",
                fontWeight: 400, fontFamily: MONO, textTransform: "uppercase",
                letterSpacing: "0.08em", borderBottom: "1px solid #1a2236",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(tx => {
            const isViolation = tx.compliance_status === "violation" || tx.compliance_status === "flagged";
            const isPending = tx.compliance_status === "pending";
            const badgeColor = isViolation ? { bg: "#200a10", color: "#ff4d6d", border: "#3a1520", label: "violation" }
              : isPending ? { bg: "#1a1200", color: "#f5a623", border: "#3a2800", label: "en attente" }
              : { bg: "#001f12", color: "#00c97e", border: "#003d22", label: "conforme" };
            return (
              <tr key={tx.id} style={{ borderBottom: "1px solid #0f1520" }}>
                <td style={{ padding: "10px 18px", fontSize: 12, color: "#4A5A7A", fontFamily: MONO }}>{tx.date}</td>
                <td style={{ padding: "10px 18px", fontSize: 13, fontWeight: 500, color: "#E8EDF5" }}>{tx.merchant}</td>
                <td style={{ padding: "10px 18px", fontSize: 11, color: "#4A5A7A", fontFamily: MONO }}>{tx.transaction_code}</td>
                <td style={{ padding: "10px 18px", fontSize: 12, color: "#E8EDF5", fontFamily: MONO, textAlign: "right" }}>{fmtCAD(tx.amount)}</td>
                <td style={{ padding: "10px 18px" }}>
                  <span style={{
                    fontSize: 10, fontFamily: MONO, fontWeight: 500, padding: "3px 8px", borderRadius: 4,
                    background: badgeColor.bg, color: badgeColor.color, border: `1px solid ${badgeColor.border}`,
                  }}>{badgeColor.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
