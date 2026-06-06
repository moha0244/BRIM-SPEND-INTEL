import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Mistral } from "@mistralai/mistralai";
import { fmtCAD } from "@/lib/format";
import { MISTRAL_MODEL, SQL_RPC } from "@/lib/config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

async function runSQL(sql: string): Promise<Record<string, unknown>[]> {
  const clean = sql.trim().replace(/;+$/, "");
  const { data, error } = await supabase.rpc(SQL_RPC, { query: clean });
  if (error) throw new Error(error.message);
  if (!data) return [];
  if (typeof data === "string") return JSON.parse(data);
  return data as Record<string, unknown>[];
}

// ─── 1. Détection SQL (règles avec detection_sql) ─────────────────────────────

async function detectViolationsSQL(): Promise<
  { transaction_id: number; rule_id: number; rule_code: string; severity: string; context: string }[]
> {
  const { data: rules, error } = await supabase
    .from("policy_rules")
    .select("id, rule_code, description_fr, severity, evidence_text, detection_sql")
    .eq("is_active", true)
    .eq("action", "flag")
    .not("detection_sql", "is", null);

  if (error || !rules?.length) return [];

  const violations: { transaction_id: number; rule_id: number; rule_code: string; severity: string; context: string }[] = [];

  for (const rule of rules) {
    try {
      const rows = await runSQL(rule.detection_sql as string);
      for (const t of rows) {
        violations.push({
          transaction_id: t.id as number,
          rule_id: rule.id as number,
          rule_code: rule.rule_code as string,
          severity: rule.severity as string,
          context: `${t.merchant_name ?? ""} (${fmtCAD(Number(t.amount_cad))}, carte ${t.transaction_code}) — ${rule.description_fr ?? ""}`,
        });
      }
    } catch (err) {
      console.error(`[SQL] ${rule.rule_code}:`, err);
    }
  }

  return violations;
}

// ─── 2. Détection IA (règles sans detection_sql) ──────────────────────────────

async function detectViolationsAI(): Promise<
  { transaction_id: number; rule_id: number; rule_code: string; severity: string; context: string }[]
> {
  const { data: rules, error } = await supabase
    .from("policy_rules")
    .select("id, rule_code, description_fr, severity, evidence_text, category")
    .eq("is_active", true)
    .eq("action", "flag")
    .is("detection_sql", null);

  if (error || !rules?.length) return [];

  // Toutes les transactions débit, groupées pour limiter le volume envoyé à Mistral
  const txns = await runSQL(`
    SELECT id, transaction_code, merchant_name, transaction_date, amount_cad,
           mcc, mcc_label, mcc_category, merchant_city
    FROM v_transactions_enriched
    WHERE debit_or_credit = 'Debit'
    ORDER BY transaction_date DESC
    LIMIT 500
  `);

  if (!txns.length) return [];

  const violations: { transaction_id: number; rule_id: number; rule_code: string; severity: string; context: string }[] = [];

  for (const rule of rules) {
    try {
      const txnList = txns.map(t =>
        `ID:${t.id} | ${t.transaction_date} | ${t.merchant_name} | ${fmtCAD(Number(t.amount_cad))} | MCC:${t.mcc} (${t.mcc_label}) | Carte:${t.transaction_code} | Ville:${t.merchant_city ?? "?"}`
      ).join("\n");

      const prompt = `Tu es un expert en conformité des dépenses d'entreprise. Analyse ces transactions et identifie celles qui violent CLAIREMENT la règle suivante.

RÈGLE : ${rule.description_fr}
PREUVE POLITIQUE : ${rule.evidence_text}
CONTEXTE : Société de transport routier au Canada.

DONNÉES DISPONIBLES PAR TRANSACTION : date, marchand, montant total, MCC, ville.
DONNÉES NON DISPONIBLES : détail du reçu, montant du pourboire, noms des invités, justification du voyage, approbation du manager.

INSTRUCTIONS STRICTES :
- Ne flag une transaction QUE si la violation est confirmable avec les données disponibles (date, marchand, montant, MCC).
- Si la règle nécessite des données absentes (ex: montant du pourboire, identité des invités, preuve d'approbation), NE PAS flag — réponds { "violations": [] }.
- Ne jamais citer une règle "par précaution" ou "à vérifier" — seulement les violations certaines.
- Si le MCC indique clairement une catégorie interdite (ex: bar/alcool), flag uniquement si le MCC est sans ambiguïté pour cette catégorie.
- Pour les règles de seuil de montant : utilise uniquement le seuil défini dans la PREUVE POLITIQUE ci-dessus. Ne suppose aucun montant fixe.

TRANSACTIONS À ANALYSER :
${txnList}

Réponds en JSON valide uniquement, sans markdown :
{
  "violations": [
    { "id": <transaction_id>, "explication": "<règle exacte citée + raison précise et vérifiable avec les données disponibles>" }
  ]
}

Si aucune transaction ne viole cette règle de façon certaine, réponds : { "violations": [] }`;

      const response = await mistral.chat.complete({
        model: MISTRAL_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        responseFormat: { type: "json_object" },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") continue;

      const parsed = JSON.parse(content) as { violations: { id: number; explication: string }[] };

      for (const v of parsed.violations ?? []) {
        if (!v.id) continue;
        violations.push({
          transaction_id: v.id,
          rule_id: rule.id as number,
          rule_code: rule.rule_code as string,
          severity: rule.severity as string,
          context: v.explication,
        });
      }
    } catch (err) {
      console.error(`[AI] ${rule.rule_code}:`, err);
    }
  }

  return violations;
}

// ─── Déduplique par (transaction_id, rule_id) ─────────────────────────────────

function dedupe<T extends { transaction_id: number; rule_id: number }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((v) => {
    const k = `${v.transaction_id}-${v.rule_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handle() {
  const all = dedupe(await detectViolationsSQL());

  if (all.length) {
    const rows = all.map((v) => ({
      transaction_id: v.transaction_id,
      rule_id: v.rule_id,
      severity: v.severity,
      ai_explanation: v.context,
      status: "open",
    }));
    const { error } = await supabase
      .from("compliance_violations")
      .upsert(rows, { onConflict: "transaction_id,rule_id", ignoreDuplicates: true });
    if (error) console.error("[upsert]", error);
  }

  const { data: violations, error: fetchError } = await supabase
    .from("compliance_violations")
    .select(`
      id, status, severity, ai_explanation, detected_at, transaction_id, rule_id,
      policy_rules ( rule_code, description_fr, evidence_text ),
      transactions ( id, transaction_code, merchant_name, transaction_date, amount_cad )
    `)
    .order("detected_at", { ascending: false })
    .limit(200);

  if (fetchError) throw fetchError;

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const v of violations ?? []) {
    const s = (v as Record<string, unknown>).severity as string;
    if (s in counts) counts[s as keyof typeof counts]++;
  }

  const normalized = (violations ?? []).map((v: Record<string, unknown>) => ({
    ...v,
    transaction: v.transactions
      ? { ...(v.transactions as Record<string, unknown>), id: (v.transactions as Record<string, unknown>).id ?? v.transaction_id }
      : { id: v.transaction_id },
    rule: v.policy_rules,
  }));

  return NextResponse.json({
    violations: normalized,
    total: normalized.length,
    new_detected: all.length,
    counts,
  });
}

export async function GET() {
  try {
    return await handle();
  } catch (err) {
    console.error("[compliance GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST() {
  try {
    return await handle();
  } catch (err) {
    console.error("[compliance POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
