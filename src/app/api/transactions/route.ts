// src/app/api/transactions/route.ts
import { NextRequest, NextResponse } from "next/server";
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
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const card = searchParams.get("card");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const highlight = searchParams.get("highlight");
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = 50;
    const offset = (page - 1) * limit;

    const search = searchParams.get("search");

    // Construire les filtres
    const filters: string[] = ["debit_or_credit = 'Debit'"];
    if (card && card !== "all") filters.push(`transaction_code = ${parseInt(card)}`);
    if (category && category !== "all") filters.push(`mcc_category = '${category.replace(/'/g, "''")}'`);
    if (status === "violation") filters.push(`id IN (SELECT DISTINCT transaction_id FROM compliance_violations WHERE status != 'dismissed')`);
    if (status === "compliant") filters.push(`id NOT IN (SELECT DISTINCT transaction_id FROM compliance_violations WHERE status != 'dismissed')`);
    if (search) filters.push(`merchant_name ILIKE '%${search.replace(/'/g, "''")}%'`);

    const where = `WHERE ${filters.join(" AND ")}`;

    const [rows, countRows, cards, categories, highlightedRow] = await Promise.all([
      sql(`SELECT v.id, v.transaction_code, v.card_label, v.transaction_date,
          v.merchant_name, v.amount_cad::numeric AS amount_cad, v.currency,
          v.mcc, v.mcc_label, v.mcc_category, v.merchant_city,
          v.compliance_status, v.approval_status
        FROM v_transactions_enriched v
        ${where}
        ORDER BY v.transaction_date DESC, v.id DESC
        LIMIT ${limit} OFFSET ${offset}`),

      sql(`SELECT COUNT(*)::integer AS count FROM v_transactions_enriched ${where}`),

      sql(`SELECT DISTINCT transaction_code, card_label
        FROM v_transactions_enriched WHERE debit_or_credit = 'Debit' ORDER BY transaction_code`),

      sql(`SELECT DISTINCT mcc_category FROM v_transactions_enriched
        WHERE debit_or_credit = 'Debit' AND mcc_category IS NOT NULL ORDER BY 1`),

      // Fetch la transaction ciblée séparément si highlight est dans l'URL
      highlight
        ? sql(`SELECT v.id, v.transaction_code, v.card_label, v.transaction_date,
              v.merchant_name, v.amount_cad::numeric AS amount_cad, v.currency,
              v.mcc, v.mcc_label, v.mcc_category, v.merchant_city,
              v.compliance_status, v.approval_status
            FROM v_transactions_enriched v
            WHERE v.id = ${parseInt(highlight)}`)
        : Promise.resolve([]),
    ]);

    // Merger la transaction ciblée en tête si elle n'est pas déjà dans les résultats
    const allRows = rows as Record<string, unknown>[];
    const highlightedRows = highlightedRow as Record<string, unknown>[];
    if (highlightedRows.length > 0) {
      const hid = highlightedRows[0].id;
      if (!allRows.find(r => r.id === hid)) {
        allRows.unshift(highlightedRows[0]);
      }
    }

    // Pour chaque transaction, chercher violation et rapport associés
    const ids = allRows.map((r) => r.id).join(",");

    const [violations, reports] = ids.length > 0
      ? await Promise.all([
          sql(`
            SELECT transaction_id, severity, ai_explanation, status
            FROM compliance_violations
            WHERE transaction_id IN (${ids})
          `),
          sql(`
            SELECT er.id AS report_id, er.report_name, er.status AS report_status,
                   v.id AS transaction_id
            FROM expense_reports er
            JOIN v_transactions_enriched v ON v.transaction_code = er.transaction_code
            WHERE v.id IN (${ids})
            AND er.date_start <= v.transaction_date
            AND er.date_end >= v.transaction_date
            LIMIT 200
          `),
        ])
      : [[], []];

    const violationMap: Record<number, Record<string, unknown>> = {};
    for (const v of violations as Record<string, unknown>[]) {
      violationMap[v.transaction_id as number] = v;
    }
    const reportMap: Record<number, Record<string, unknown>> = {};
    for (const r of reports as Record<string, unknown>[]) {
      reportMap[r.transaction_id as number] = r;
    }

    const transactions = allRows.map((t) => ({
      id: t.id,
      transaction_code: t.transaction_code,
      card_label: String(t.card_label ?? ""),
      date: String(t.transaction_date ?? "").slice(0, 10),
      merchant: String(t.merchant_name ?? ""),
      amount: Number(t.amount_cad ?? 0),
      currency: String(t.currency ?? "CAD"),
      mcc: t.mcc,
      mcc_label: String(t.mcc_label ?? ""),
      mcc_category: String(t.mcc_category ?? ""),
      city: String(t.merchant_city ?? ""),
      compliance_status: violationMap[t.id as number] ? "violation" : "compliant",
      approval_status: t.approval_status,
      violation: violationMap[t.id as number] ?? null,
      report: reportMap[t.id as number] ?? null,
    }));

    return NextResponse.json({
      transactions,
      total: Number((countRows as Record<string, unknown>[])[0]?.count ?? 0),
      page,
      cards: (cards as Record<string, unknown>[]).map((c) => ({
        code: c.transaction_code,
        label: c.card_label,
      })),
      categories: (categories as Record<string, unknown>[]).map((c) =>
        String(c.mcc_category),
      ),
    });
  } catch (err) {
    console.error("[Transactions API]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
