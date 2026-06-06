"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MONO, fmtCAD } from "@/lib/format";

const MONTH_LABELS: Record<string, string> = {
  "2025-08": "Août", "2025-09": "Sep", "2025-10": "Oct", "2025-11": "Nov",
  "2025-12": "Déc", "2026-01": "Jan", "2026-02": "Fév", "2026-03": "Mar",
};

const tooltipStyle = {
  fontSize: 11, fontFamily: MONO, borderRadius: 6,
  border: "1px solid #1a2236", background: "#0B1120", color: "#E8EDF5",
};

interface MonthlyChartProps {
  data: { month: string; total: number }[];
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  const chartData = data.map(m => ({ ...m, label: MONTH_LABELS[m.month] ?? m.month }));
  return (
    <div style={{ background: "#0B1120", border: "1px solid #1a2236", borderRadius: 10, padding: "16px 18px" }}>
      <p style={{ fontSize: 9, color: "#3A4A6A", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 14 }}>
        Tendance des dépenses mensuelles
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2236" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#3A4A6A", fontFamily: MONO }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => fmtCAD(v, true)} tick={{ fontSize: 10, fill: "#3A4A6A", fontFamily: MONO }} width={58} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: number) => [fmtCAD(v), "Total"]} contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="total" stroke="#3b6aff" strokeWidth={2} dot={{ fill: "#3b6aff", r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
