// src/app/api/compliance/setup/route.ts
// Génère et stocke les requêtes SQL de détection pour chaque policy_rule via Mistral
import { NextResponse } from "next/server";
import { Mistral } from "@mistralai/mistralai";
import { createClient } from "@supabase/supabase-js";
import { MISTRAL_MODEL, SQL_RPC } from "@/lib/config";

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function runSQL(query: string) {
  const { data, error } = await supabase.rpc(SQL_RPC, { query: query.trim() });
  if (error) throw new Error(error.message);
  return data ?? [];
}

const SCHEMA_CONTEXT = `
VUE PRINCIPALE : v_transactions_enriched
Colonnes disponibles :
  id (integer), transaction_code (integer) — identifiant de la carte
  merchant_name (text), transaction_date (date)
  amount (numeric) — montant en devise originale
  amount_cad (numeric) — montant converti en CAD
  currency (text), conversion_rate (numeric)
  debit_or_credit (text) — toujours filtrer WHERE debit_or_credit = 'Debit'
  mcc (integer) — merchant category code
  mcc_label (text) — ex: 'Carburant', 'Services gouvernementaux / Permis'
  mcc_category (text) — ex: 'Transport', 'Permis & Gouvernement'
  merchant_city (text), merchant_country (text), merchant_state_province (text)
  compliance_status (text), approval_status (text)

RÈGLES SQL OBLIGATOIRES :
1. Toujours inclure WHERE debit_or_credit = 'Debit'
2. Retourner au minimum : id, transaction_code, merchant_name, transaction_date, amount_cad
3. LIMIT 100 maximum
4. Ne jamais utiliser de sous-requêtes corrélées complexes
5. Utiliser ORDER BY amount_cad DESC pour prioriser les montants élevés
6. Pour les agrégations GROUP BY : ne jamais utiliser d'alias dans GROUP BY
7. mcc est INTEGER, jamais de guillemets autour des valeurs MCC
`;

async function loadMccLabels(): Promise<{ mcc: number; label_fr: string; category: string }[]> {
  const { data, error } = await supabase.from("mcc_labels").select("mcc, label_fr, category").order("mcc");
  if (error || !data) return [];
  return data as { mcc: number; label_fr: string; category: string }[];
}

async function generateSQLForRule(
  rule: {
    id: number;
    rule_code: string;
    description_fr: string;
    rule_type: string;
    condition_json: Record<string, unknown>;
    threshold_amount: number | null;
    evidence_text: string;
    category: string;
  },
  mccLabels: { mcc: number; label_fr: string; category: string }[]
): Promise<string | null> {
  const mccList = mccLabels.map(m => `  mcc=${m.mcc} → "${m.label_fr}" (${m.category})`).join("\n");

  const prompt = `Tu es un expert PostgreSQL. Génère une requête SQL SELECT qui détecte les transactions violant cette règle de politique de dépenses.

${SCHEMA_CONTEXT}

RÈGLE À DÉTECTER :
- Code : ${rule.rule_code}
- Catégorie : ${rule.category}
- Description : ${rule.description_fr}
- Type : ${rule.rule_type}
- Condition JSON : ${JSON.stringify(rule.condition_json)}
- Seuil : ${rule.threshold_amount ?? "N/A"}
- Preuve : ${rule.evidence_text}

CONTEXTE ENTREPRISE : Société de transport routier (camionnage) au Canada.
Les MCC suivants sont des dépenses opérationnelles normales pour cette entreprise.
Pour les règles de seuil ou de pré-autorisation, EXCLURE ces MCC avec AND mcc NOT IN (...) :

${mccList}

Utilise cette liste pour déterminer quels MCC exclure selon le contexte de la règle.
Ne jamais exclure un MCC qui est directement concerné par la règle elle-même.

Génère UNIQUEMENT la requête SQL (sans explication, sans markdown, sans commentaires).
La requête doit retourner les transactions qui VIOLENT cette règle.
Si la règle ne peut pas être détectée par SQL (ex: règle purement documentaire), retourne NULL.`;

  try {
    const response = await mistral.chat.complete({
      model: MISTRAL_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return null;

    // Nettoyer la réponse
    const sql = content
      .replace(/```sql\s*/gi, "")
      .replace(/```\s*/g, "")
      .replace(/^null$/i, "")
      .trim();

    if (!sql || sql.toUpperCase() === "NULL") return null;
    if (!sql.toUpperCase().startsWith("SELECT")) return null;

    return sql;
  } catch (err) {
    console.error(`[Setup] Erreur génération SQL pour ${rule.rule_code}:`, err);
    return null;
  }
}

export async function POST() {
  try {
    // Charger toutes les règles actives sans SQL (ou toutes pour régénérer)
    const { data: rules, error } = await supabase
      .from("policy_rules")
      .select("id, rule_code, description_fr, rule_type, condition_json, threshold_amount, evidence_text, category, detection_sql")
      .eq("is_active", true);

    if (error) throw error;

    const mccLabels = await loadMccLabels();

    const results = {
      total: rules?.length ?? 0,
      generated: 0,
      skipped: 0,
      failed: 0,
      details: [] as { rule_code: string; status: string; sql?: string }[],
    };

    for (const rule of rules ?? []) {
      // Sauter si SQL déjà généré (sauf si on force la régénération)
      if (rule.detection_sql) {
        results.skipped++;
        results.details.push({ rule_code: rule.rule_code, status: "already_exists" });
        continue;
      }

      const sql = await generateSQLForRule(rule as Parameters<typeof generateSQLForRule>[0], mccLabels);

      if (!sql) {
        results.failed++;
        results.details.push({ rule_code: rule.rule_code, status: "no_sql_generated" });
        continue;
      }

      // Sauvegarder le SQL dans la DB
      const { error: updateError } = await supabase
        .from("policy_rules")
        .update({ detection_sql: sql })
        .eq("id", rule.id);

      if (updateError) {
        results.failed++;
        results.details.push({ rule_code: rule.rule_code, status: `error: ${updateError.message}` });
      } else {
        results.generated++;
        results.details.push({ rule_code: rule.rule_code, status: "generated", sql: sql.slice(0, 100) + "..." });
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("[Setup]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — voir l'état des SQL générés
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("policy_rules")
      .select("id, rule_code, description_fr, detection_sql")
      .eq("is_active", true)
      .order("id");

    if (error) throw error;

    return NextResponse.json({
      rules: data?.map(r => ({
        id: r.id,
        rule_code: r.rule_code,
        description_fr: r.description_fr,
        has_sql: !!r.detection_sql,
        sql_preview: r.detection_sql?.slice(0, 80) ?? null,
      })),
      stats: {
        total: data?.length ?? 0,
        with_sql: data?.filter(r => r.detection_sql).length ?? 0,
        without_sql: data?.filter(r => !r.detection_sql).length ?? 0,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
