"use client";
import { Search } from "lucide-react";
import { MONO } from "@/lib/format";

const selectStyle = {
  background: "#0B1120", border: "1px solid #1a2236", borderRadius: 6,
  color: "#8A9AB8", fontSize: 12, padding: "6px 10px", cursor: "pointer",
  fontFamily: "Inter, sans-serif", outline: "none",
};

interface TxFilterBarProps {
  search: string;
  card: string;
  category: string;
  status: string;
  total: number;
  loading: boolean;
  cards: { code: number; label: string }[];
  categories: string[];
  onSearch: (v: string) => void;
  onSubmitSearch: (e: React.FormEvent) => void;
  onCard: (v: string) => void;
  onCategory: (v: string) => void;
  onStatus: (v: string) => void;
}

export function TxFilterBar({
  search, card, category, status, total, loading,
  cards, categories,
  onSearch, onSubmitSearch, onCard, onCategory, onStatus,
}: TxFilterBarProps) {
  return (
    <div style={{
      padding: "12px 24px", borderBottom: "1px solid #1a2236",
      display: "flex", alignItems: "center", gap: 10,
      background: "#080C12", flexShrink: 0, flexWrap: "wrap",
    }}>
      <form onSubmit={onSubmitSearch} style={{ display: "flex", gap: 0 }}>
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Rechercher un marchand..."
          style={{
            background: "#0B1120", border: "1px solid #1a2236",
            borderRight: "none", borderRadius: "6px 0 0 6px",
            color: "#E8EDF5", fontSize: 12, padding: "6px 12px",
            fontFamily: "Inter, sans-serif", outline: "none", width: 200,
          }}
        />
        <button type="submit" style={{
          background: "#0B1120", border: "1px solid #1a2236",
          borderRadius: "0 6px 6px 0", padding: "6px 10px",
          color: "#3A4A6A", cursor: "pointer", display: "flex", alignItems: "center",
        }}>
          <Search size={13} />
        </button>
      </form>

      <div style={{ width: 1, height: 20, background: "#1a2236" }} />

      <select style={selectStyle} value={card} onChange={e => onCard(e.target.value)}>
        <option value="all">Toutes les cartes</option>
        {cards.map(c => <option key={c.code} value={String(c.code)}>Carte {c.code}{c.label ? ` — ${c.label}` : ""}</option>)}
      </select>

      <select style={selectStyle} value={category} onChange={e => onCategory(e.target.value)}>
        <option value="all">Toutes catégories</option>
        {categories.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      <select style={selectStyle} value={status} onChange={e => onStatus(e.target.value)}>
        <option value="all">Tous statuts</option>
        <option value="compliant">Conforme</option>
        <option value="violation">Violation</option>
      </select>

      <span style={{ marginLeft: "auto", fontSize: 11, color: "#3A4A6A", fontFamily: MONO }}>
        {loading ? "..." : `${total.toLocaleString("fr-CA")} résultats`}
      </span>
    </div>
  );
}
