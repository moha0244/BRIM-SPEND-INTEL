// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Mistral } from "@mistralai/mistralai";
import { createClient } from "@supabase/supabase-js";
import { fmtCAD } from "@/lib/format";
import { MISTRAL_MODEL, SQL_RPC } from "@/lib/config";

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function runSQL(query: string) {
  const { data, error } = await supabase.rpc(SQL_RPC, { query: query.trim() });
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}

// ─── GET — liste des rapports ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get("id");
    const meta = searchParams.get("meta");
    const metaCard = searchParams.get("card");

    // Plage de dates réelle depuis Supabase (pour pré-remplir le modal)
    if (meta === "1") {
      const cardFilter = metaCard ? `AND transaction_code = ${parseInt(metaCard)}` : "";
      const rows = await runSQL(`
        SELECT MIN(transaction_date)::text AS date_min,
               MAX(transaction_date)::text AS date_max
        FROM v_transactions_enriched
        WHERE debit_or_credit = 'Debit' ${cardFilter}
      `);
      const row = rows[0] ?? {};
      return NextResponse.json({
        date_min: String(row.date_min ?? "").slice(0, 10),
        date_max: String(row.date_max ?? "").slice(0, 10),
      });
    }

    if (reportId) {
      // Détail d'un rapport spécifique
      const { data: report, error } = await supabase
        .from("expense_reports")
        .select("*")
        .eq("id", parseInt(reportId))
        .single();

      if (error) throw error;

      // Transactions liées via expense_report_items (source de vérité)
      // Fallback sur filtre carte+dates si aucun item enregistré (anciens rapports)
      const itemIds = await runSQL(`SELECT transaction_id FROM expense_report_items WHERE report_id = ${reportId}`);
      let txns: Record<string, unknown>[];
      if (itemIds.length > 0) {
        const ids = itemIds.map(r => r.transaction_id).join(",");
        txns = await runSQL(`SELECT id, transaction_code, merchant_name,
            transaction_date, amount_cad, mcc_label, mcc_category
          FROM v_transactions_enriched
          WHERE id IN (${ids})
          ORDER BY transaction_date DESC`);
      } else {
        txns = await runSQL(`SELECT id, transaction_code, merchant_name,
            transaction_date, amount_cad, mcc_label, mcc_category
          FROM v_transactions_enriched
          WHERE transaction_code = ${report.transaction_code}
            AND transaction_date BETWEEN '${report.date_start}' AND '${report.date_end}'
            AND debit_or_credit = 'Debit'
          ORDER BY transaction_date DESC`);
      }

      // Violations dans ce rapport
      const ids = txns.map(t => t.id).join(",");
      const violations = ids
        ? await runSQL(`SELECT transaction_id, severity, ai_explanation
            FROM compliance_violations
            WHERE transaction_id IN (${ids}) AND status = 'open'`)
        : [];

      return NextResponse.json({ report, transactions: txns, violations });
    }

    // Liste tous les rapports
    const { data, error } = await supabase
      .from("expense_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ reports: data ?? [] });
  } catch (err) {
    console.error("[Reports GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── POST — générer un rapport ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { card_code, date_start, date_end, transaction_ids, grouping } = await req.json();

    let txns: Record<string, unknown>[] = [];

    if (transaction_ids?.length) {
      // Transactions sélectionnées manuellement
      txns = await runSQL(`SELECT id, transaction_code, merchant_name,
          transaction_date, amount_cad, mcc_label, mcc_category
        FROM v_transactions_enriched
        WHERE id IN (${transaction_ids.join(",")}) AND debit_or_credit = 'Debit'
        ORDER BY transaction_date ASC`);
    } else if (date_start && date_end) {
      // Mode Période (toutes cartes ou carte spécifique) OU mode Carte (plage auto)
      const cardFilter = card_code ? `AND transaction_code = ${card_code}` : "";
      txns = await runSQL(`SELECT id, transaction_code, merchant_name,
          transaction_date, amount_cad, mcc_label, mcc_category
        FROM v_transactions_enriched
        WHERE transaction_date BETWEEN '${date_start}' AND '${date_end}'
          AND debit_or_credit = 'Debit'
          ${cardFilter}
        ORDER BY transaction_date ASC`);
    }

    if (!txns.length) {
      return NextResponse.json({ error: "Aucune transaction trouvée pour ces critères" }, { status: 400 });
    }

    const totalAmount = txns.reduce((sum, t) => sum + Number(t.amount_cad ?? 0), 0);
    const cardCode = txns[0].transaction_code as number;
    const dateMin = String(txns[0].transaction_date).slice(0, 10);
    const dateMax = String(txns[txns.length - 1].transaction_date).slice(0, 10);

    // Appel Mistral pour nommer le rapport + reco CFO
    const prompt = `Tu es un analyste financier pour une société de transport routier au Canada.
Analyse ce groupe de ${txns.length} transactions (carte ${cardCode}, ${dateMin} → ${dateMax}, total ${fmtCAD(totalAmount)}).

Top marchands : ${[...new Set(txns.slice(0, 5).map(t => t.merchant_name))].join(", ")}
Catégories : ${[...new Set(txns.map(t => t.mcc_category))].filter(Boolean).join(", ")}
Groupement demandé : ${grouping ?? "période"}

Réponds en JSON :
{
  "report_name": "<nom court et descriptif en français, ex: 'Voyage Toronto — Jan 2026' ou 'Carburant Carte 3001 — Q1 2026'>",
  "cfo_recommendation": "<2-3 phrases en français pour le CFO : résumé des dépenses, conformité globale, recommandation Approuver/Réviser>"
}`;

    let reportName = `Rapport ${cardCode} — ${dateMin}`;
    let cfoRecommendation = "Rapport généré automatiquement.";

    try {
      const response = await mistral.chat.complete({
        model: MISTRAL_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        responseFormat: { type: "json_object" },
      });
      const content = response.choices?.[0]?.message?.content;
      if (content && typeof content === "string") {
        const parsed = JSON.parse(content);
        reportName = parsed.report_name ?? reportName;
        cfoRecommendation = parsed.cfo_recommendation ?? cfoRecommendation;
      }
    } catch (e) {
      console.error("[Reports AI]", e);
    }

    // Sauvegarder le rapport
    const { data: report, error } = await supabase
      .from("expense_reports")
      .insert({
        report_name: reportName,
        transaction_code: cardCode,
        date_start: dateMin,
        date_end: dateMax,
        total_amount_cad: totalAmount,
        transaction_count: txns.length,
        ai_summary: cfoRecommendation,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;

    // Lier les transactions au rapport
    const items = txns.map(t => ({ report_id: report.id, transaction_id: t.id as number }));
    const { error: itemsError } = await supabase.from("expense_report_items").insert(items);
    if (itemsError) console.error("[Reports items]", itemsError.message);

    return NextResponse.json({ success: true, report, transactions: txns.length });
  } catch (err) {
    console.error("[Reports POST]", err);
    const msg = err instanceof Error ? err.message : (err as { message?: string }).message ?? JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── PATCH — mettre à jour le statut ─────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    const { error } = await supabase
      .from("expense_reports")
      .update({ status })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Erreur mise à jour" }, { status: 500 });
  }
}
