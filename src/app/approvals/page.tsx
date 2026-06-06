// src/app/approvals/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { TabNav } from "@/components/ui/TabNav";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { MONO } from "@/lib/format";
import type { ApprovalRequest, ApprovalStats } from "@/lib/types";

type Tab = "pending" | "approved" | "rejected";

const TAB_COLORS: Record<Tab, string> = {
  pending: "#f5a623", approved: "#00c97e", rejected: "#ff4d6d",
};

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [stats, setStats] = useState<ApprovalStats>({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/approvals");
    const data = await res.json();
    setRequests(data.requests ?? []);
    setStats(data.stats ?? { pending: 0, approved: 0, rejected: 0 });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(id: number, decision: string) {
    const res = await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    if (!res.ok) {
      console.error("[decide] PATCH failed", await res.text());
      return;
    }
    setRequests(prev => prev.map(r => r.id === id ? { ...r, decision } : r));
    setStats(prev => ({
      ...prev,
      pending: Math.max(0, prev.pending - 1),
      [decision === "approved" ? "approved" : "rejected"]:
        prev[decision === "approved" ? "approved" : "rejected"] + 1,
    }));
  }

  const filtered = requests.filter(r => {
    if (tab === "pending") return !r.decision || r.decision === "pending";
    if (tab === "approved") return r.decision === "approved";
    return r.decision === "rejected";
  });

  const tabs = [
    { key: "pending"  as Tab, label: "En attente", count: stats.pending,  color: TAB_COLORS.pending },
    { key: "approved" as Tab, label: "Approuvées",  count: stats.approved, color: TAB_COLORS.approved },
    { key: "rejected" as Tab, label: "Refusées",    count: stats.rejected, color: TAB_COLORS.rejected },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#080C12" }}>
      <TabNav tabs={tabs} active={tab} onChange={setTab} />

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            message={tab === "pending"
              ? "Aucune approbation en attente — allez sur Conformité et cliquez \"Demander une approbation\""
              : "Aucune demande dans cet onglet"}
            action={tab === "pending" ? (
              <Link href="/compliance" style={{ fontSize: 11, color: "#3b6aff", textDecoration: "none", border: "1px solid #1a2a40", borderRadius: 6, padding: "6px 14px" }}>
                Aller à Conformité →
              </Link>
            ) : undefined}
          />
        ) : (
          filtered.map(r => <ApprovalCard key={r.id} req={r} onDecide={decide} />)
        )}
      </div>
    </div>
  );
}
