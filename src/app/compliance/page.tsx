// src/app/compliance/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Loader2, ShieldCheck } from "lucide-react";
import { ViolationCard } from "@/components/compliance/ViolationCard";
import { RecidivistesTable } from "@/components/compliance/RecidivistesTable";
import { TabNav } from "@/components/ui/TabNav";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { SEV_CONFIG } from "@/components/ui/Badge";
import { MONO } from "@/lib/format";
import type { Violation, ComplianceStats } from "@/lib/types";

const PER_PAGE = 10;

type TabKey = "critical" | "high" | "medium";

export default function CompliancePage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("critical");
  const [page, setPage] = useState(1);
  const [requesting, setRequesting] = useState<number | null>(null); // id violation en cours

  const fetchViolations = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/compliance");
    const data = await res.json();
    setViolations(data.violations ?? []);
    setStats(data.stats ?? null);
    setLoading(false);
    return data.violations ?? [];
  }, []);

  useEffect(() => {
    fetchViolations().then((v) => {
      if (v.length === 0) {
        setRunning(true);
        setRunStatus("Première analyse automatique...");
        fetch("/api/compliance", { method: "POST" })
          .then(r => r.json())
          .then(data => {
            setRunStatus(data.error ? `Erreur : ${data.error}` : `✓ ${data.new_detected ?? data.total ?? 0} détectées · ${data.total ?? 0} en base`);
            return fetchViolations();
          })
          .finally(() => setRunning(false));
      }
    });
  }, [fetchViolations]);

  async function runAnalysis() {
    setRunning(true);
    setRunStatus("Analyse en cours...");
    try {
      const res = await fetch("/api/compliance", { method: "POST" });
      const data = await res.json();
      setRunStatus(data.error
        ? `Erreur : ${data.error}`
        : `✓ ${data.new_detected ?? data.total ?? 0} détectées · ${data.total ?? 0} en base`);
    } catch {
      setRunStatus("Erreur réseau");
    }
    await fetchViolations();
    setRunning(false);
  }

  async function updateStatus(id: number, status: string) {
    await fetch("/api/compliance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setViolations(prev => prev.map(v => v.id === id ? { ...v, status: status as Violation["status"] } : v));
  }

  async function requestApproval(v: Violation) {
    setRequesting(v.id);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction_id: v.transaction.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(`Erreur : ${data.error ?? "Impossible de créer la demande"}`);
      } else if (data.message?.includes("déjà")) {
        alert(`Une demande existe déjà pour ${v.transaction.merchant_name}`);
      } else {
        alert(`✓ Approbation demandée pour ${v.transaction.merchant_name}\nRecommandation IA : ${data.recommendation}`);
      }
    } catch {
      alert("Erreur réseau — réessaie");
    } finally {
      setRequesting(null);
    }
  }

  const openViolations = violations.filter(v => v.status === "open");
  const filtered = openViolations.filter(v => v.severity === tab);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const tabs = [
    { key: "critical" as TabKey, label: "Critique", count: stats?.critical ?? 0, color: SEV_CONFIG.critical.color },
    { key: "high"     as TabKey, label: "Élevé",    count: openViolations.filter(v => v.severity === "high").length, color: SEV_CONFIG.high.color },
    { key: "medium"   as TabKey, label: "Moyen",    count: openViolations.filter(v => v.severity === "medium").length, color: SEV_CONFIG.medium.color },
  ];

  function handleTabChange(t: TabKey) { setTab(t); setPage(1); }

  const analyseBtn = (
    <button onClick={runAnalysis} disabled={running} style={{
      display: "flex", alignItems: "center", gap: 6,
      background: "#00c97e", color: "#020a04", border: "none", borderRadius: 6,
      padding: "7px 14px", fontSize: 11, fontWeight: 500,
      cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.7 : 1,
    }}>
      {running ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={12} />}
      {running ? "Analyse..." : "Lancer l'analyse IA"}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#080C12" }}>
      <TabNav tabs={tabs} active={tab} onChange={handleTabChange} rightSlot={analyseBtn} />

      {runStatus && (
        <div style={{ padding: "8px 24px", borderBottom: "1px solid #1a2236", flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: running ? "#f5a623" : "#00c97e", fontFamily: MONO }}>
            {running ? "⟳ " : "✓ "}{runStatus}
          </p>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            message={violations.length === 0
              ? "Aucune violation — Lancez l'analyse IA pour détecter"
              : `Aucune violation ${tabs.find(t => t.key === tab)?.label.toLowerCase()} ouverte`}
          />
        ) : (
          paginated.map(v => (
            <ViolationCard key={v.id} v={v} onRequestApproval={requestApproval} onResolve={updateStatus} isRequesting={requesting === v.id} />
          ))
        )}

        {!loading && violations.length > 0 && (
          <RecidivistesTable violations={violations} />
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={filtered.length}
        perPage={PER_PAGE}
        onChange={(p) => { setPage(p); }}
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
