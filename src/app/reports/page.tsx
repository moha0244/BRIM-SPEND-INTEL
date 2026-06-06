// src/app/reports/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, FileText } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { GenerateModal } from "@/components/reports/GenerateModal";
import { ReportTable } from "@/components/reports/ReportTable";
import type { Report } from "@/lib/types";

const PER_PAGE = 15;

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/reports");
    const data = await res.json();
    setReports(data.reports ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const paginated = reports.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#080C12" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #1a2236", flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontWeight: 500, color: "#E8EDF5", margin: 0 }}>Rapports de dépenses</h1>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "#3b6aff", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
        >
          <Plus size={14} /> Générer un rapport
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {loading ? (
          <LoadingSpinner />
        ) : reports.length === 0 ? (
          <EmptyState icon={FileText} message='Aucun rapport — cliquez "Générer un rapport" pour commencer' />
        ) : (
          <ReportTable reports={paginated} />
        )}
      </div>

      <Pagination
        page={page}
        totalPages={Math.ceil(reports.length / PER_PAGE)}
        total={reports.length}
        perPage={PER_PAGE}
        onChange={setPage}
      />

      {showModal && <GenerateModal onClose={() => setShowModal(false)} onGenerated={load} />}
    </div>
  );
}
