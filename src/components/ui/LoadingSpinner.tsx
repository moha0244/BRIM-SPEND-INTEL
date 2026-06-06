// src/components/ui/LoadingSpinner.tsx

import { Loader2 } from "lucide-react";

const MONO = "'IBM Plex Mono', monospace";

interface LoadingSpinnerProps {
  label?: string;
}

export function LoadingSpinner({ label = "Chargement..." }: LoadingSpinnerProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 8,
        color: "#3A4A6A",
      }}
    >
      <Loader2 size={14} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontFamily: MONO }}>{label}</span>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
