import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface AlertCardProps {
  count: number;
  label: string;
  icon: LucideIcon;
  href: string;
  type: "danger" | "warn" | "info";
}

const COLORS = {
  danger: { bg: "#1a0510", border: "#3a1520", num: "#ff4d6d", text: "#ff4d6d" },
  warn:   { bg: "#1a1200", border: "#3a2800", num: "#f5a623", text: "#f5a623" },
  info:   { bg: "#0a1220", border: "#1a2a40", num: "#5a7aff", text: "#5a7aff" },
};

export function AlertCard({ count, label, icon: Icon, href, type }: AlertCardProps) {
  const c = COLORS[type];
  return (
    <Link href={href} style={{ textDecoration: "none", flex: 1 }}>
      <div style={{
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 10, padding: "20px 24px",
        display: "flex", alignItems: "center", gap: 16,
        cursor: "pointer", height: "100%",
      }}>
        <Icon size={22} style={{ color: c.text, flexShrink: 0 }} />
        <div>
          <p style={{
            fontSize: 36, fontWeight: 600, color: c.num,
            fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1, marginBottom: 4,
          }}>
            {count}
          </p>
          <p style={{ fontSize: 12, color: c.text }}>{label}</p>
        </div>
      </div>
    </Link>
  );
}
