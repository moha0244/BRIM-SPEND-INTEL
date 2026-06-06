// src/app/api/dashboard/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SQL_RPC } from "@/lib/config";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function sql(query: string) {
  const supabase = getClient();
  const { data, error } = await supabase.rpc(SQL_RPC, { query: query.trim() });
  if (error) {
    return [];
  }
  return data ?? [];
}

export async function GET() {
  try {
    // 1. KPIs de base
    const kpiRows = await sql(`
      SELECT
        COALESCE(SUM(amount_cad), 0)::numeric AS total_spend,
        COUNT(*)::integer AS total_transactions,
        COALESCE(AVG(amount_cad), 0)::numeric AS avg_transaction,
        MIN(transaction_date)::text AS date_min,
        MAX(transaction_date)::text AS date_max
      FROM v_transactions_enriched
      WHERE debit_or_credit = 'Debit'
    `);

    // 2. Tendance mensuelle
    const monthlyRows = await sql(`
      SELECT
        TO_CHAR(transaction_date, 'YYYY-MM') AS month,
        COALESCE(SUM(amount_cad), 0)::numeric AS total
      FROM v_transactions_enriched
      WHERE debit_or_credit = 'Debit'
      GROUP BY TO_CHAR(transaction_date, 'YYYY-MM')
      ORDER BY 1
    `);

    // 3. Top catégories MCC
    const mccRows = await sql(`
      SELECT
        COALESCE(mcc_category, mcc_label, 'Autre') AS category,
        COALESCE(SUM(amount_cad), 0)::numeric AS total,
        COUNT(*)::integer AS nb
      FROM v_transactions_enriched
      WHERE debit_or_credit = 'Debit'
      GROUP BY COALESCE(mcc_category, mcc_label, 'Autre')
      ORDER BY 2 DESC
      LIMIT 6
    `);

    // 4. Transactions récentes avec statut calculé depuis compliance_violations
    const recentRows = await sql(`
      SELECT
        v.id,
        v.transaction_code,
        v.card_label,
        v.transaction_date,
        v.merchant_name,
        COALESCE(v.amount_cad, 0)::numeric AS amount_cad,
        v.mcc_label,
        CASE WHEN cv.id IS NOT NULL THEN 'violation' ELSE 'compliant' END AS compliance_status
      FROM v_transactions_enriched v
      LEFT JOIN compliance_violations cv ON cv.transaction_id = v.id AND cv.status = 'open'
      WHERE v.debit_or_credit = 'Debit'
      ORDER BY v.transaction_date DESC, v.id DESC
      LIMIT 10
    `);

    // 5. Violations ouvertes
    const violationRows = await sql(`
      SELECT
        COUNT(*)::integer AS total,
        COALESCE(SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END), 0)::integer AS critical
      FROM compliance_violations
      WHERE status = 'open'
    `);

    // 6. Transactions avec violation (pour taux conformité)
    const violatedRows = await sql(`
      SELECT COUNT(DISTINCT transaction_id)::integer AS count
      FROM compliance_violations
      WHERE status = 'open'
    `);

    // 7. Approbations en attente
    const approvalRows = await sql(`
      SELECT COUNT(*)::integer AS count
      FROM approval_requests
      WHERE decision IS NULL OR decision = 'pending'
    `);

    // 8. Rapports en attente CFO
    const reportRows = await sql(`
      SELECT COUNT(*)::integer AS count
      FROM expense_reports
      WHERE status IN ('pending_cfo', 'submitted', 'En attente CFO')
    `);

    const kpi = kpiRows[0] ?? {};
    const viol = violationRows[0] ?? {};
    const totalTxns = Number(kpi.total_transactions ?? 0);
    const violatedCount = Number(violatedRows[0]?.count ?? 0);
    const complianceRate =
      totalTxns > 0
        ? Math.round(((totalTxns - violatedCount) / totalTxns) * 100)
        : 100;

    return NextResponse.json({
      alerts: {
        criticalViolations: Number(viol.critical ?? 0),
        pendingApprovals: Number(approvalRows[0]?.count ?? 0),
        pendingReports: Number(reportRows[0]?.count ?? 0),
      },
      kpis: {
        totalSpend: Number(kpi.total_spend ?? 0),
        totalTransactions: totalTxns,
        avgTransaction: Number(kpi.avg_transaction ?? 0),
        complianceRate,
        dateMin: String(kpi.date_min ?? "").slice(0, 10),
        dateMax: String(kpi.date_max ?? "").slice(0, 10),
      },
      monthly: monthlyRows.map((m: Record<string, unknown>) => ({
        month: String(m.month ?? ""),
        total: Number(m.total ?? 0),
      })),
      mccCategories: mccRows.map((c: Record<string, unknown>) => ({
        category: String(c.category ?? ""),
        total: Number(c.total ?? 0),
        nb: Number(c.nb ?? 0),
      })),
      recentTransactions: recentRows.map((t: Record<string, unknown>) => ({
        id: t.id,
        transaction_code: t.transaction_code,
        card_label: String(t.card_label ?? ""),
        date: String(t.transaction_date ?? "").slice(0, 10),
        merchant: String(t.merchant_name ?? ""),
        amount: Number(t.amount_cad ?? 0),
        mcc_label: String(t.mcc_label ?? ""),
        compliance_status: String(t.compliance_status ?? "compliant"),
      })),
    });
  } catch (err) {
    console.error("[Dashboard fatal]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
