import { MONO, fmtCAD } from "@/lib/format";

interface MCCChartProps {
  categories: { category: string; total: number }[];
}

export function MCCChart({ categories }: MCCChartProps) {
  const max = categories[0]?.total ?? 1;
  return (
    <div style={{
      background: "#0B1120", border: "1px solid #1a2236",
      borderRadius: 10, padding: "16px 18px",
    }}>
      <p style={{
        fontSize: 9, color: "#3A4A6A", textTransform: "uppercase",
        letterSpacing: "0.1em", fontFamily: MONO, marginBottom: 14,
      }}>
        Dépenses par catégorie MCC
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {categories.map(cat => (
          <div key={cat.category}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "#8A9AB8", fontFamily: MONO }}>{cat.category}</span>
              <span style={{ fontSize: 11, color: "#E8EDF5", fontFamily: MONO }}>{fmtCAD(cat.total, true)}</span>
            </div>
            <div style={{ height: 6, background: "#1a2236", borderRadius: 3 }}>
              <div style={{
                width: `${(cat.total / max) * 100}%`,
                height: "100%", background: "#3b6aff", borderRadius: 3,
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
