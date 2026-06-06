"use client";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { MONO } from "@/lib/format";

const inputStyle = {
  background: "#0B1120", border: "1px solid #1a2236", borderRadius: 6,
  color: "#E8EDF5", fontSize: 12, padding: "8px 12px", width: "100%",
  fontFamily: "Inter, sans-serif", outline: "none",
};

interface Card { code: number; label: string }

interface GenerateModalProps {
  onClose: () => void;
  onGenerated: () => void;
}

export function GenerateModal({ onClose, onGenerated }: GenerateModalProps) {
  const [grouping, setGrouping] = useState<"period" | "card">("period");
  const [cards, setCards] = useState<Card[]>([]);
  const [cardCode, setCardCode] = useState<string>("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les cartes disponibles + plage de dates réelle depuis Supabase
  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch("/api/transactions?page=1");
        const data = await res.json();
        if (data.cards?.length) {
          setCards(data.cards);
          setCardCode(String(data.cards[0].code));
        }
        // Plage de dates réelle
        const metaRes = await fetch("/api/reports?meta=1");
        const meta = await metaRes.json();
        if (meta.date_min) setDateStart(meta.date_min);
        if (meta.date_max) setDateEnd(meta.date_max);
      } catch {
        // fallback silencieux
      } finally {
        setLoadingMeta(false);
      }
    }
    loadMeta();
  }, []);

  // Quand on passe en mode "Carte", charger la plage de dates pour cette carte
  useEffect(() => {
    if (grouping !== "card" || !cardCode) return;
    async function loadCardDates() {
      const res = await fetch(`/api/reports?meta=1&card=${cardCode}`);
      const meta = await res.json();
      if (meta.date_min) setDateStart(meta.date_min);
      if (meta.date_max) setDateEnd(meta.date_max);
    }
    loadCardDates();
  }, [grouping, cardCode]);

  async function generate() {
    setGenerating(true);
    setError(null);
    const body: Record<string, unknown> = { grouping };

    if (grouping === "card") {
      // Mode Carte : toutes les transactions de cette carte (dates auto)
      body.card_code = parseInt(cardCode);
      body.date_start = dateStart;
      body.date_end = dateEnd;
    } else {
      // Mode Période : toutes les cartes sur la plage choisie
      body.date_start = dateStart;
      body.date_end = dateEnd;
      if (cardCode) body.card_code = parseInt(cardCode);
    }

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); setGenerating(false); return; }
    setGenerating(false);
    onGenerated();
    onClose();
  }

  const GROUPINGS = [
    { key: "period", label: "Période", hint: "Toutes les cartes sur une plage de dates" },
    { key: "card",   label: "Carte",   hint: "Historique complet d'une carte" },
  ] as const;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#0B1120", border: "1px solid #1a2236", borderRadius: 12, padding: "28px 32px", width: 540, display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: "#E8EDF5", margin: 0 }}>Générer un rapport</h2>

        {/* Critère de regroupement */}
        <div>
          <p style={{ fontSize: 11, color: "#3A4A6A", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Critère de regroupement</p>
          <div style={{ display: "flex", gap: 8 }}>
            {GROUPINGS.map(g => (
              <button key={g.key} onClick={() => setGrouping(g.key)} style={{
                padding: "8px 20px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "Inter, sans-serif",
                background: grouping === g.key ? "#E8EDF5" : "transparent",
                color: grouping === g.key ? "#080C12" : "#3A4A6A",
                border: `1px solid ${grouping === g.key ? "#E8EDF5" : "#1a2236"}`,
              }}>{g.label}</button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#3A4A6A", marginTop: 6, fontFamily: MONO }}>
            {GROUPINGS.find(g => g.key === grouping)?.hint}
          </p>
        </div>

        {/* Carte — toujours visible, obligatoire en mode Carte, optionnelle en mode Période */}
        <div>
          <p style={{ fontSize: 11, color: "#3A4A6A", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            Carte{grouping === "period" ? " (optionnel)" : ""}
          </p>
          {loadingMeta ? (
            <div style={{ ...inputStyle, color: "#3A4A6A" }}>Chargement…</div>
          ) : (
            <select value={cardCode} onChange={e => setCardCode(e.target.value)} style={{ ...inputStyle }}>
              {grouping === "period" && <option value="">— Toutes les cartes —</option>}
              {cards.map(c => <option key={c.code} value={c.code}>{c.label || `Carte ${c.code}`}</option>)}
            </select>
          )}
        </div>

        {/* Dates — pré-remplies depuis Supabase, masquées en mode Carte (auto) */}
        {grouping === "period" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {([["Date début", dateStart, setDateStart], ["Date fin", dateEnd, setDateEnd]] as const).map(([label, val, setter]) => (
              <div key={label}>
                <p style={{ fontSize: 11, color: "#3A4A6A", fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</p>
                <input type="date" value={val} onChange={e => setter(e.target.value)} style={inputStyle} />
              </div>
            ))}
          </div>
        )}

        {grouping === "card" && dateStart && (
          <p style={{ fontSize: 11, color: "#3A4A6A", fontFamily: MONO }}>
            Plage détectée : {dateStart} → {dateEnd}
          </p>
        )}

        {error && <p style={{ fontSize: 12, color: "#ff4d6d", fontFamily: MONO }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 20px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: "#3A4A6A", border: "1px solid #1a2236", fontFamily: "Inter, sans-serif" }}>
            Annuler
          </button>
          <button onClick={generate} disabled={generating || loadingMeta} style={{ padding: "9px 20px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "#3b6aff", color: "#fff", border: "none", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: 6, opacity: (generating || loadingMeta) ? 0.7 : 1 }}>
            {generating && <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />}
            {generating ? "Génération IA…" : "Créer le rapport"}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
