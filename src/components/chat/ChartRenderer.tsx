// src/components/chat/ChartRenderer.tsx
// 100% inline styles — zéro Tailwind
"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ChartData } from "@/hooks/useChat";

const COLORS = [
  "#00F5A0",
  "#5a7aff",
  "#f5a623",
  "#ff4d6d",
  "#00c97e",
  "#a78bfa",
  "#38bdf8",
  "#fb923c",
];

const tooltipStyle = {
  fontSize: 11,
  fontFamily: "'IBM Plex Mono', monospace",
  borderRadius: 6,
  border: "1px solid #1a2236",
  background: "#0B1120",
  color: "#E8EDF5",
};

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M$`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k$`;
  return `${Math.round(n)}$`;
}

function fmtFull(n: number) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

// Extrait les données peu importe la structure retournée par l'API
function extractData(chartData: ChartData): Record<string, unknown>[] {
  // Cas 1 : données directes dans data[]
  if (Array.isArray(chartData.data) && chartData.data.length > 0) {
    return chartData.data;
  }
  // Cas 2 : données dans totals[]
  if (Array.isArray(chartData.totals) && chartData.totals.length > 0) {
    return chartData.totals;
  }
  // Cas 3 : données dans top_merchants[]
  if (
    Array.isArray(chartData.top_merchants) &&
    chartData.top_merchants.length > 0
  ) {
    return chartData.top_merchants;
  }
  // Cas 4 : données dans top_categories[]
  if (
    Array.isArray(chartData.top_categories) &&
    chartData.top_categories.length > 0
  ) {
    return chartData.top_categories;
  }
  // Cas 5 : results est un objet avec des tableaux dedans
  if (chartData.results && typeof chartData.results === "object") {
    const vals = Object.values(chartData.results);
    const firstArray = vals.find(
      (v) => Array.isArray(v) && (v as unknown[]).length > 0,
    );
    if (firstArray) return firstArray as Record<string, unknown>[];
  }
  return [];
}

// Trouve les meilleures clés X et Y automatiquement
function findKeys(
  data: Record<string, unknown>[],
  xHint?: string,
  yHint?: string,
): { xKey: string; yKey: string } {
  if (!data.length) return { xKey: "", yKey: "" };
  const keys = Object.keys(data[0]);

  const X_CANDIDATES = [
    "month",
    "mois",
    "categorie",
    "category",
    "merchant_name",
    "marchand",
    "transaction_code",
    "card_label",
    "mcc",
    "mcc_label",
    "mcc_category",
    "name",
    "label",
    "periode",
  ];
  const Y_CANDIDATES = [
    "total",
    "total_cad",
    "total_spent",
    "total_fuel_spend",
    "total_amount_cad",
    "amount_cad",
    "nb_transactions",
    "nb",
    "count",
    "transaction_count",
    "total_combine",
    "z_score",
    "value",
    "montant",
  ];

  const xKey =
    (xHint && keys.includes(xHint) ? xHint : null) ??
    X_CANDIDATES.find((k) => keys.includes(k)) ??
    keys.find((k) => typeof data[0][k] === "string") ??
    keys[0];

  const yKey =
    (yHint && keys.includes(yHint) ? yHint : null) ??
    Y_CANDIDATES.find((k) => keys.includes(k)) ??
    keys.find((k) => typeof data[0][k] === "number") ??
    keys[1];

  return { xKey, yKey };
}

function isCurrencyKey(key: string) {
  return [
    "total",
    "total_cad",
    "total_spent",
    "total_fuel_spend",
    "amount_cad",
    "avg_cad",
    "total_combine",
  ].some((k) => key.includes(k));
}

// ─── Table ────────────────────────────────────────────────────────────────────

function DataTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data.length)
    return (
      <p
        style={{
          fontSize: 11,
          color: "#3A4A6A",
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        Aucune donnée.
      </p>
    );

  const headers = Object.keys(data[0]);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #1a2236" }}>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "5px 8px",
                  fontSize: 9,
                  color: "#3A4A6A",
                  fontWeight: 400,
                  fontFamily: "'IBM Plex Mono', monospace",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {h.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 25).map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #1a2236" }}>
              {headers.map((h) => {
                const val = row[h];
                const isNum = typeof val === "number";
                const isCurr = isCurrencyKey(h);
                return (
                  <td
                    key={h}
                    style={{
                      padding: "7px 8px",
                      fontSize: 11,
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: isNum ? "#E8EDF5" : "#8A9AB8",
                      textAlign: isNum ? "right" : "left",
                    }}
                  >
                    {isCurr && isNum
                      ? fmtFull(val as number)
                      : isNum
                        ? (val as number).toLocaleString("fr-CA", {
                            maximumFractionDigits: 2,
                          })
                        : String(val ?? "—")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 25 && (
        <p
          style={{
            fontSize: 9,
            color: "#2A3A55",
            fontFamily: "'IBM Plex Mono', monospace",
            marginTop: 6,
            paddingLeft: 8,
          }}
        >
          {data.length} résultats — affichage des 25 premiers
        </p>
      )}
    </div>
  );
}

// ─── Number cards ─────────────────────────────────────────────────────────────

function NumberCards({ data }: { data: Record<string, unknown>[] }) {
  if (!data.length) return null;
  const entries = Object.entries(data[0]);
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}
    >
      {entries.slice(0, 4).map(([key, val]) => {
        const isNum = typeof val === "number";
        const isCurr = isCurrencyKey(key);
        return (
          <div
            key={key}
            style={{
              background: "#0F1A2E",
              border: "1px solid #1a2236",
              borderRadius: 6,
              padding: "10px 12px",
            }}
          >
            <p
              style={{
                fontSize: 9,
                color: "#3A4A6A",
                fontFamily: "'IBM Plex Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 4,
              }}
            >
              {key.replace(/_/g, " ")}
            </p>
            <p
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: "#00F5A0",
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {isCurr && isNum
                ? fmtFull(val as number)
                : isNum
                  ? (val as number).toLocaleString("fr-CA", {
                      maximumFractionDigits: 2,
                    })
                  : String(val ?? "—")}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ChartRenderer({ chartData }: { chartData: ChartData }) {
  const data = extractData(chartData);

  // Si pas de données, n'affiche rien
  if (!data || data.length === 0) {
    console.warn(
      "[ChartRenderer] Aucune donnée trouvée dans chartData:",
      chartData,
    );
    return null;
  }

  const { xKey, yKey } = findKeys(data, chartData.x_axis, chartData.y_axis);
  const isMonetary = isCurrencyKey(yKey);

  const axisStyle = {
    fontSize: 9,
    fill: "#3A4A6A",
    fontFamily: "'IBM Plex Mono', monospace",
  };

  return (
    <div
      style={{
        marginTop: 6,
        background: "#080C12",
        border: "1px solid #1a2236",
        borderRadius: 8,
        padding: "12px 14px",
        width: "100%",
      }}
    >
      {/* Titre */}
      <p
        style={{
          fontSize: 9,
          color: "#3A4A6A",
          fontFamily: "'IBM Plex Mono', monospace",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 12,
        }}
      >
        {chartData.chart_title}
      </p>

      {/* Contenu selon le type */}
      {chartData.chart_type === "number" && <NumberCards data={data} />}

      {chartData.chart_type === "table" && <DataTable data={data} />}

      {(chartData.chart_type === "bar" || chartData.chart_type === "none") &&
        xKey &&
        yKey &&
        data.length > 0 && (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart
              data={data}
              margin={{ top: 4, right: 4, bottom: 50, left: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2236" />
              <XAxis
                dataKey={xKey}
                tick={axisStyle}
                angle={-35}
                textAnchor="end"
                interval={0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={isMonetary ? fmtCompact : undefined}
                tick={axisStyle}
                width={55}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [
                  isMonetary ? fmtFull(Number(v)) : Number(v).toLocaleString("fr-CA"),
                  yKey.replace(/_/g, " "),
                ]}
                contentStyle={tooltipStyle}
              />
              <Bar
                dataKey={yKey}
                fill="#00F5A0"
                radius={[3, 3, 0, 0]}
                opacity={0.9}
              />
            </BarChart>
          </ResponsiveContainer>
        )}

      {chartData.chart_type === "line" && xKey && yKey && (
        <ResponsiveContainer width="100%" height={210}>
          <LineChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 50, left: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2236" />
            <XAxis
              dataKey={xKey}
              tick={axisStyle}
              angle={-35}
              textAnchor="end"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={isMonetary ? fmtCompact : undefined}
              tick={axisStyle}
              width={55}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v: number) => [
                isMonetary ? fmtFull(v) : v.toLocaleString("fr-CA"),
                yKey.replace(/_/g, " "),
              ]}
              contentStyle={tooltipStyle}
            />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke="#00F5A0"
              strokeWidth={1.5}
              dot={{ fill: "#00F5A0", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {chartData.chart_type === "pie" && xKey && yKey && (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) =>
                `${String(name).slice(0, 14)} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [
                isMonetary ? fmtFull(v) : v.toLocaleString("fr-CA"),
              ]}
              contentStyle={tooltipStyle}
            />
            <Legend
              wrapperStyle={{
                fontSize: 10,
                fontFamily: "'IBM Plex Mono', monospace",
                color: "#3A4A6A",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}

      {/* Footer */}
      <p
        style={{
          fontSize: 9,
          color: "#2A3A55",
          fontFamily: "'IBM Plex Mono', monospace",
          marginTop: 10,
        }}
      >
        {data.length} ligne{data.length > 1 ? "s" : ""} · Supabase live
      </p>
    </div>
  );
}
