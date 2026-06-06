import { MONO } from "@/lib/format";

interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  mono?: boolean;
}

export function StatCard({ label, value, color = "#E8EDF5", mono = true }: StatCardProps) {
  return (
    <div style={{
      background: "#0B1120", border: "1px solid #1a2236",
      borderRadius: 10, padding: "16px 20px", flex: 1,
    }}>
      <p style={{
        fontSize: 9, color: "#3A4A6A", textTransform: "uppercase",
        letterSpacing: "0.12em", fontFamily: MONO, marginBottom: 8,
      }}>
        {label}
      </p>
      <p style={{
        fontSize: 22, fontWeight: 500, color,
        fontFamily: mono ? MONO : "Inter, sans-serif", lineHeight: 1,
      }}>
        {value}
      </p>
    </div>
  );
}
