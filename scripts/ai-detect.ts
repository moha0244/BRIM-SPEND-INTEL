// scripts/ai-detect.ts
// Détection IA des violations pour les règles sans detection_sql
// Conçu pour tourner en tâche planifiée (ex: chaque nuit)
// Lance avec : npx tsx scripts/ai-detect.ts

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Mistral } from "@mistralai/mistralai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

const BATCH_SIZE = 200;   // transactions par appel Mistral
const DELAY_MS   = 2000;  // délai entre appels pour éviter le rate limit

function fmtCAD(amount: number): string {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount);
}

function log(msg: string) {
  console.log(`[ai-detect] ${msg}`);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function runSQL(sql: string): Promise<Record<string, unknown>[]> {
  const clean = sql.trim().replace(/;+$/, "");
  const { data, error } = await supabase.rpc("run_sql_query", { query: clean });
  if (error) throw new Error(error.message);
  if (!data) return [];
  if (typeof data === "string") return JSON.parse(data);
  return data as Record<string, unknown>[];
}

async function analyzeRuleWithAI(
  rule: { id: number; rule_code: string; description_fr: string; severity: string; evidence_text: string },
  transactions: Record<string, unknown>[]
): Promise<{ transaction_id: number; explication: string }[]> {
  const results: { transaction_id: number; explication: string }[] = [];

  // Découper en batches
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);

    const txnList = batch.map(t =>
      `ID:${t.id} | ${t.transaction_date} | ${t.merchant_name} | ${fmtCAD(Number(t.amount_cad))} | MCC:${t.mcc} (${t.mcc_label}) | Carte:${t.transaction_code} | Ville:${t.merchant_city ?? "?"}`
    ).join("\n");

    const prompt = `Tu es un expert en conformité des dépenses d'entreprise. Analyse ces transactions et identifie celles qui violent la règle suivante.

RÈGLE : ${rule.description_fr}
PREUVE POLITIQUE : ${rule.evidence_text}
CONTEXTE : Société de transport routier au Canada. Les dépenses de carburant, permis gouvernementaux, péages et réparations véhicule sont normales et ne comptent pas comme violations.

TRANSACTIONS (${batch.length}) :
${txnList}

Réponds en JSON valide uniquement, sans markdown :
{
  "violations": [
    { "id": <transaction_id>, "explication": "<pourquoi c'est une violation, en français, 1 phrase>" }
  ]
}

Si aucune violation, réponds : { "violations": [] }
Sois strict — ne signale que les vraies violations évidentes.`;

    let retries = 3;
    while (retries > 0) {
      try {
        const response = await mistral.chat.complete({
          model: "mistral-large-latest",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          responseFormat: { type: "json_object" },
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content || typeof content !== "string") break;

        const parsed = JSON.parse(content) as { violations: { id: number; explication: string }[] };
        results.push(...(parsed.violations ?? []).map(v => ({
          transaction_id: v.id,
          explication: v.explication,
        })));
        break;

      } catch (err: unknown) {
        const msg = String(err);
        if (msg.includes("429") || msg.includes("rate_limit")) {
          retries--;
          log(`  ⏳ Rate limit — attente 15s (${retries} essais restants)`);
          await sleep(15000);
        } else {
          log(`  ✗ Erreur batch ${i}-${i + BATCH_SIZE}: ${msg}`);
          break;
        }
      }
    }

    if (i + BATCH_SIZE < transactions.length) {
      await sleep(DELAY_MS);
    }
  }

  return results;
}

async function main() {
  log("=== Démarrage détection IA ===");

  // 1. Règles sans detection_sql
  const { data: rules, error: rulesError } = await supabase
    .from("policy_rules")
    .select("id, rule_code, description_fr, severity, evidence_text")
    .eq("is_active", true)
    .eq("action", "flag")
    .is("detection_sql", null);

  if (rulesError) throw rulesError;
  if (!rules?.length) { log("Aucune règle sans detection_sql — terminé"); return; }

  log(`${rules.length} règles à analyser par IA`);

  // 2. Toutes les transactions débit
  const transactions = await runSQL(`
    SELECT id, transaction_code, merchant_name, transaction_date, amount_cad,
           mcc, mcc_label, mcc_category, merchant_city
    FROM v_transactions_enriched
    WHERE debit_or_credit = 'Debit'
    ORDER BY transaction_date DESC
  `);

  log(`${transactions.length} transactions à analyser`);

  let totalViolations = 0;

  // 3. Analyser chaque règle
  for (const rule of rules) {
    log(`\n→ Règle : ${rule.rule_code}`);

    const violations = await analyzeRuleWithAI(rule, transactions);
    log(`  ${violations.length} violation(s) détectée(s)`);

    if (violations.length) {
      const rows = violations.map(v => ({
        transaction_id: v.transaction_id,
        rule_id: rule.id,
        severity: rule.severity,
        ai_explanation: v.explication,
        status: "open",
      }));

      const { error } = await supabase
        .from("compliance_violations")
        .upsert(rows, { onConflict: "transaction_id,rule_id", ignoreDuplicates: true });

      if (error) log(`  ✗ Erreur upsert: ${error.message}`);
      else totalViolations += violations.length;
    }

    await sleep(DELAY_MS);
  }

  log(`\n=== Terminé — ${totalViolations} violations insérées ===`);
}

main().catch(err => {
  console.error("[ai-detect] ERREUR:", err);
  process.exit(1);
});
