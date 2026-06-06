import { MONO } from "@/lib/format";

interface PageHeaderProps {
  title: string;
  action?: React.ReactNode;
  sub?: string;
}

export function PageHeader({ title, action, sub }: PageHeaderProps) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 24px", borderBottom: "1px solid #1a2236",
      flexShrink: 0, background: "#080C12",
    }}>
      <div>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: "#E8EDF5", margin: 0 }}>{title}</h1>
        {sub && <p style={{ fontSize: 11, color: "#3A4A6A", fontFamily: MONO, marginTop: 3 }}>{sub}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
