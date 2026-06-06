// src/app/api/approvals/route.ts
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


// ─── Générer une recommandation IA ───────────────────────────────────────────

async function generateRecommendation(transactionId: number) {
  // Récupérer la transaction
  const txns = await runSQL(`SELECT id, transaction_code, merchant_name, transaction_date,
      amount_cad, mcc_label, mcc_category, merchant_city, merchant_country
    FROM v_transactions_enriched WHERE id = ${transactionId}`);

  if (!txns.length) return { recommendation: "Prudence", reasoning: "Transaction introuvable." };
  const t = txns[0];

  // Historique de la carte sur cette catégorie
  const history = await runSQL(`SELECT COUNT(*)::integer AS nb, AVG(amount_cad)::numeric AS avg_amount,
      SUM(amount_cad)::numeric AS total
    FROM v_transactions_enriched
    WHERE transaction_code = ${t.transaction_code}
      AND mcc_category = '${String(t.mcc_category).replace(/'/g, "''")}'
      AND debit_or_credit = 'Debit'
      AND id != ${transactionId}`);

  const hist = history[0] ?? {};

  const prompt = `Tu es un analyste financier pour une société de transport routier au Canada.
Évalue cette demande d'approbation et donne une recommandation claire.

TRANSACTION :
- Marchand: ${t.merchant_name}
- Montant: ${fmtCAD(t.amount_cad as number)}
- Catégorie: ${t.mcc_label} (${t.mcc_category})
- Carte: ${t.transaction_code}
- Ville: ${t.merchant_city ?? "N/A"}, ${t.merchant_country ?? "N/A"}
- Date: ${String(t.transaction_date).slice(0, 10)}

HISTORIQUE DE CETTE CARTE (même catégorie) :
- ${hist.nb ?? 0} transactions similaires
- Montant moyen: ${fmtCAD(Number(hist.avg_amount ?? 0))}
- Total historique: ${fmtCAD(Number(hist.total ?? 0))}

Réponds en JSON :
{
  "recommendation": "Approuver" | "Refuser" | "Prudence",
  "reasoning": "<1-2 phrases en français expliquant pourquoi>"
}`;

  try {
    const response = await mistral.chat.complete({
      model: MISTRAL_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      responseFormat: { type: "json_object" },
    });
    const content = response.choices?.[0]?.message?.content;
    if (content && typeof content === "string") {
      const parsed = JSON.parse(content);
      return { recommendation: parsed.recommendation, reasoning: parsed.reasoning };
    }
  } catch (e) {
    console.error("[Approvals AI]", e);
  }

  return { recommendation: "Prudence", reasoning: "Analyse IA indisponible — vérifier manuellement." };
}

// ─── GET — liste des approbations ────────────────────────────────────────────

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("approval_requests")
      .select(`
        id, ai_recommendation, ai_reasoning, decision, created_at,
        transaction:transactions (
          id, transaction_code, merchant_name, transaction_date,
          amount_cad, currency, merchant_city
        )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const stats = {
      pending: data?.filter(r => !r.decision || r.decision === "pending").length ?? 0,
      approved: data?.filter(r => r.decision === "approved").length ?? 0,
      rejected: data?.filter(r => r.decision === "rejected").length ?? 0,
    };

    return NextResponse.json({ requests: data ?? [], stats });
  } catch (err) {
    console.error("[Approvals GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── POST — créer une demande d'approbation ───────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { transaction_id } = await req.json();
    if (!transaction_id) return NextResponse.json({ error: "transaction_id requis" }, { status: 400 });

    // Vérifier si une demande existe déjà
    const { data: existing } = await supabase
      .from("approval_requests")
      .select("id")
      .eq("transaction_id", transaction_id)
      .single();

    if (existing) return NextResponse.json({ message: "Demande déjà existante", id: existing.id });

    // Générer la recommandation IA
    const { recommendation, reasoning } = await generateRecommendation(transaction_id);

    const { data, error } = await supabase
      .from("approval_requests")
      .insert({
        transaction_id,
        ai_recommendation: recommendation, // On garde les valeurs françaises : "Approuver"/"Refuser"/"Prudence"
        ai_reasoning: reasoning,
        decision: null,
      })
      .select()
      .single();

    if (error) {
      console.error("[Approvals INSERT error]", JSON.stringify(error));
      return NextResponse.json({ error: error.message ?? JSON.stringify(error) }, { status: 500 });
    }
    return NextResponse.json({ success: true, id: data.id, recommendation, reasoning });
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[Approvals POST]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── PATCH — approuver ou refuser ────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const { id, decision } = await req.json();

    // 1. Mettre à jour approval_requests
    const { data: approvalData, error } = await supabase
      .from("approval_requests")
      .update({ decision, decision_at: new Date().toISOString() })
      .eq("id", id)
      .select("transaction_id")
      .maybeSingle();

    if (error) throw error;

    // 2. Répercuter sur transactions.approval_status
    if (approvalData?.transaction_id) {
      await supabase
        .from("transactions")
        .update({ approval_status: decision })
        .eq("id", approvalData.transaction_id);

      // 3. Si approuvé, dismisser les violations de conformité liées
      if (decision === "approved") {
        await supabase
          .from("compliance_violations")
          .update({ status: "dismissed" })
          .eq("transaction_id", approvalData.transaction_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Erreur mise à jour" }, { status: 500 });
  }
}
