// src/components/ui/EmptyState.tsx
// État vide réutilisable

import type { LucideIcon } from "lucide-react";

const MONO = "'IBM Plex Mono', monospace";

interface EmptyStateProps {
  icon?: LucideIcon;
  message: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, message, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 12,
        padding: "60px 0",
      }}
    >
      {Icon && <Icon size={32} style={{ color: "#1a2236" }} />}
      <p style={{ fontSize: 12, color: "#3A4A6A", fontFamily: MONO, textAlign: "center" }}>
        {message}
      </p>
      {action}
    </div>
  );
}
