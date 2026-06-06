// src/components/ui/Pagination.tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONO } from "@/lib/format";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onChange: (page: number) => void;
}

function getPages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [];

  // Toujours afficher la première page
  pages.push(1);

  if (current > 4) pages.push("...");

  // Pages autour de la page courante
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 3) pages.push("...");

  // Toujours afficher la dernière page
  pages.push(total);

  return pages;
}

const btnBase = {
  minWidth: 30, height: 30, borderRadius: 6,
  fontSize: 11, fontFamily: MONO, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  border: "1px solid #1a2236", transition: "all 0.1s",
};

export function Pagination({ page, totalPages, total, perPage, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPages(page, totalPages);
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div style={{
      flexShrink: 0, borderTop: "1px solid #1a2236",
      padding: "10px 24px", display: "flex", alignItems: "center",
      justifyContent: "space-between", background: "#080C12",
    }}>
      {/* Compteur */}
      <span style={{ fontSize: 11, color: "#3A4A6A", fontFamily: MONO }}>
        {from}–{to} sur {total.toLocaleString("fr-CA")}
      </span>

      {/* Numéros de pages */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {/* Précédent */}
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          style={{
            ...btnBase,
            padding: "0 10px",
            background: "transparent",
            color: page === 1 ? "#2A3A55" : "#8A9AB8",
            cursor: page === 1 ? "not-allowed" : "pointer",
          }}
        >
          <ChevronLeft size={13} />
        </button>

        {pages.map((p, i) =>
          p === "..." ? (
            <span
              key={`ellipsis-${i}`}
              style={{ width: 30, textAlign: "center", color: "#2A3A55", fontSize: 11, fontFamily: MONO }}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              style={{
                ...btnBase,
                background: p === page ? "#3b6aff" : "transparent",
                color: p === page ? "#fff" : "#3A4A6A",
                border: p === page ? "none" : "1px solid #1a2236",
                fontWeight: p === page ? 600 : 400,
              }}
            >
              {p}
            </button>
          )
        )}

        {/* Suivant */}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          style={{
            ...btnBase,
            padding: "0 10px",
            background: "transparent",
            color: page === totalPages ? "#2A3A55" : "#8A9AB8",
            cursor: page === totalPages ? "not-allowed" : "pointer",
          }}
        >
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Saut rapide */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#3A4A6A", fontFamily: MONO }}>Aller à</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          defaultValue={page}
          key={page}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = parseInt((e.target as HTMLInputElement).value);
              if (v >= 1 && v <= totalPages) onChange(v);
            }
          }}
          style={{
            width: 48, background: "#0B1120", border: "1px solid #1a2236",
            borderRadius: 6, color: "#E8EDF5", fontSize: 11, padding: "4px 8px",
            fontFamily: MONO, outline: "none", textAlign: "center",
          }}
        />
        <span style={{ fontSize: 11, color: "#3A4A6A", fontFamily: MONO }}>/ {totalPages}</span>
      </div>
    </div>
  );
}
