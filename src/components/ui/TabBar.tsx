"use client";
import { MONO } from "@/lib/format";

export interface Tab<T extends string> {
  key: T;
  label: string;
  count?: number;
  color?: string;
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (key: T) => void;
  right?: React.ReactNode;
}

export function TabBar<T extends string>({ tabs, active, onChange, right }: TabBarProps<T>) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      padding: "0 24px", borderBottom: "1px solid #1a2236",
      flexShrink: 0, background: "#080C12",
    }}>
      {tabs.map(t => {
        const isActive = active === t.key;
        const color = t.color ?? "#E8EDF5";
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              padding: "14px 20px", fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? color : "#3A4A6A",
              background: "transparent", border: "none",
              borderBottom: `2px solid ${isActive ? color : "transparent"}`,
              cursor: "pointer", fontFamily: "Inter, sans-serif",
              transition: "all 0.12s",
            }}
          >
            {t.label}
            {t.count !== undefined && (
              <span style={{ marginLeft: 8, fontSize: 11, fontFamily: MONO, color: isActive ? color : "#2A3A55" }}>
                ({t.count})
              </span>
            )}
          </button>
        );
      })}
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}
