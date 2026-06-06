"use client";
import { useEffect, useState } from "react";
import { ShieldAlert, Clock, TrendingUp } from "lucide-react";
import { AlertCard } from "@/components/dashboard/AlertCard";
import { MonthlyChart } from "@/components/dashboard/MonthlyChart";
import { MCCChart } from "@/components/dashboard/MCCChart";
import { RecentTxTable } from "@/components/dashboard/RecentTxTable";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { fmtCAD } from "@/lib/format";
import type { DashboardData } from "@/lib/types";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(d => { if (d.error) setError(true); else setData(d); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error || !data) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ff4d6d", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
      ERREUR DE CONNEXION — Vérifiez Supabase
    </div>
  );

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#080C12", display: "flex", flexDirection: "column", gap: 12, padding: "20px 24px 24px" }}>

      <div style={{ display: "flex", gap: 12 }}>
        <AlertCard count={data.alerts.criticalViolations} label="Violations critiques ouvertes" icon={ShieldAlert} href="/compliance" type="danger" />
        <AlertCard count={data.alerts.pendingApprovals} label="Approbations en attente" icon={Clock} href="/approvals" type="warn" />
        <AlertCard count={data.alerts.pendingReports} label="Rapports en attente de signature" icon={TrendingUp} href="/reports" type="info" />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <StatCard label="Dépenses totales" value={fmtCAD(data.kpis.totalSpend)} />
        <StatCard label="Transactions" value={data.kpis.totalTransactions.toLocaleString("fr-CA")} />
        <StatCard label="Montant moyen" value={fmtCAD(data.kpis.avgTransaction)} />
        <StatCard label="Taux de conformité" value={`${data.kpis.complianceRate}%`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
        <MonthlyChart data={data.monthly} />
        <MCCChart categories={data.mccCategories} />
      </div>

      <RecentTxTable rows={data.recentTransactions} />
    </div>
  );
}
