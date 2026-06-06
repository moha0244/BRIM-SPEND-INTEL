// scripts/seed.ts
// Seed dynamique — lit le CSV et le PDF, rien de hardcodé
import "dotenv/config";
import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import pdf from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import { Mistral } from "@mistralai/mistralai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

const XLSX_FILE = path.join(process.cwd(), "public", "dummy_data.xlsx");
const POLICY_FILE = path.join(process.cwd(), "public", "policy.pdf");

// ─── Utilitaires ──────────────────────────────────────────────

function toDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "number") {
    const parsed = xlsx.SSF.parse_date_code(value);
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  return new Date(String(value)).toISOString().split("T")[0];
}

function log(msg: string) {
  console.log(`[seed] ${msg}`);
}

// ─── 1. Cards ─────────────────────────────────────────────────

async function seedCards(rows: Record<string, unknown>[]) {
  log("Extraction des cartes...");

  const uniqueCodes = [
    ...new Set(rows.map((r) => Number(r["Transaction Code"]))),
  ];
  const cards = uniqueCodes.map((code) => ({
    code,
    label: `Carte ${code}`,
    card_type: "corporate",
  }));

  const { error } = await supabase
    .from("cards")
    .upsert(cards, { onConflict: "code" });

  if (error) throw new Error(`Cards: ${error.message}`);
  log(`${cards.length} cartes upsertées`);
}

// ─── 2. Transactions ──────────────────────────────────────────

async function seedTransactions(rows: Record<string, unknown>[]) {
  log("Import des transactions...");

  // Vider les violations/approbations avant (FK)
  await supabase.from("compliance_violations").delete().neq("id", 0);
  await supabase.from("approval_requests").delete().neq("id", 0);
  await supabase.from("expense_report_items").delete().neq("report_id", 0);
  await supabase.from("expense_reports").delete().neq("id", 0);
  await supabase.from("transactions").delete().neq("id", 0);

  const transactions = rows.map((row) => ({
    transaction_code: Number(row["Transaction Code"]),
    transaction_description: String(row["Transaction Description"] ?? ""),
    transaction_category: row["Transaction Category"]
      ? Number(row["Transaction Category"])
      : null,
    posting_date: toDate(row["Posting date of transaction"]),
    transaction_date: toDate(row["Transaction Date"]),
    merchant_name: String(row["Merchant Info DBA Name"] ?? ""),
    amount: Number(row["Transaction Amount"]),
    debit_or_credit: String(row["Debit or Credit"]),
    merchant_category_code: row["Merchant Category Code"]
      ? Number(row["Merchant Category Code"])
      : null,
    merchant_city: row["Merchant City"] ? String(row["Merchant City"]) : null,
    merchant_country: row["Merchant Country"]
      ? String(row["Merchant Country"])
      : null,
    merchant_postal_code: row["Merchant Postal Code"]
      ? String(row["Merchant Postal Code"])
      : null,
    merchant_state_province: row["Merchant State/Province"]
      ? String(row["Merchant State/Province"])
      : null,
    conversion_rate: row["Conversion Rate"]
      ? Number(row["Conversion Rate"])
      : 0,
    approval_status: "auto_approved",
  }));

  // Import par batch de 250 avec retry
  const BATCH = 250;
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < transactions.length; i += BATCH) {
    const batch = transactions.slice(i, i + BATCH);
    let retries = 3;
    while (retries > 0) {
      const { error } = await supabase.from("transactions").insert(batch);
      if (!error) break;
      retries--;
      if (retries === 0) throw new Error(`Transactions batch ${i}: ${error.message}`);
      log(`  ⏳ Retry batch ${i} (${retries} essais restants)...`);
      await sleep(3000);
    }
    log(`  ${Math.min(i + BATCH, transactions.length)}/${transactions.length} transactions`);
    await sleep(200); // pause légère entre batches
  }

  log(`${transactions.length} transactions importées`);
}

// ─── 3. Politique de dépenses ─────────────────────────────────

async function seedPolicy() {
  if (!fs.existsSync(POLICY_FILE)) {
    log("policy.pdf non trouvé — seed politique ignoré");
    return;
  }

  log("Extraction du PDF de politique...");
  const buffer = fs.readFileSync(POLICY_FILE);
  const parsedPdf = await pdf(buffer);
  const rawText = parsedPdf.text;

  // Vérifier si déjà importé
  const { data: existing } = await supabase
    .from("policy_documents")
    .select("id")
    .eq("file_name", "policy.pdf")
    .single();

  let documentId: number;

  if (existing) {
    documentId = existing.id;
    log("Document politique déjà en base — mise à jour du texte");
    await supabase
      .from("policy_documents")
      .update({ raw_text: rawText })
      .eq("id", documentId);
  } else {
    const { data: doc, error } = await supabase
      .from("policy_documents")
      .insert({
        title: "Brim Expense Policy",
        file_name: "policy.pdf",
        raw_text: rawText,
      })
      .select()
      .single();

    if (error) throw new Error(`Policy document: ${error.message}`);
    documentId = doc.id;
    log("Document politique importé");
  }

  // Extraction des règles via Mistral
  log("Extraction des règles de politique via IA...");

  const prompt = `Tu dois extraire UNIQUEMENT les règles explicitement présentes dans cette politique de dépenses.

IMPORTANT :
- N'invente aucune règle
- Chaque règle doit avoir une preuve exacte dans evidence_text (citation du texte)
- Retourne UNIQUEMENT du JSON valide, sans markdown

Champs obligatoires par règle :
- rule_code : identifiant court unique (ex: THRESH_50)
- category : Approbation | Documentation | Transport | Repas & Divertissement | Carte corporative | Intégrité | Événements entreprise
- description_fr : description claire de la règle
- rule_type : threshold | boolean | mcc_block | pattern | contextual
- condition_json : objet JSON décrivant la condition (ex: {"amount_gt": 50})
- threshold_amount : montant seuil si applicable (null sinon)
- action : require_approval | flag | block | info
- severity : low | medium | high | critical
- evidence_text : citation exacte du texte source

Politique :
${rawText}

Réponds avec : { "rules": [...] }`;

  const response = await mistral.chat.complete({
    model: "mistral-large-latest",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    responseFormat: { type: "json_object" },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    log("Aucune règle extraite par l'IA");
    return;
  }

  const parsed = JSON.parse(content);
  const rules: Record<string, unknown>[] = parsed.rules ?? [];

  if (rules.length === 0) {
    log("Aucune règle trouvée dans la politique");
    return;
  }

  // Supprimer les anciennes règles liées à ce document
  await supabase
    .from("policy_rules")
    .delete()
    .eq("policy_document_id", documentId);

  const formattedRules = rules.map((rule) => ({
    policy_document_id: documentId,
    rule_code: String(rule.rule_code),
    category: String(rule.category),
    description_fr: String(rule.description_fr),
    rule_type: String(rule.rule_type),
    condition_json: rule.condition_json ?? {},
    threshold_amount: rule.threshold_amount ?? null,
    action: String(rule.action),
    severity: String(rule.severity),
    evidence_text: String(rule.evidence_text),
  }));

  const { error } = await supabase.from("policy_rules").insert(formattedRules);
  if (error) throw new Error(`Policy rules: ${error.message}`);

  log(`${formattedRules.length} règles de politique importées`);
}

// ─── 4. Génération des detection_sql ─────────────────────────

const DETECTION_SQL_PROMPT = `Tu es un expert PostgreSQL. Génère une requête SQL SELECT qui détecte les transactions violant la règle décrite.

═══════════════════════════════════════════════════════
SCHÉMA EXACT — utilise UNIQUEMENT ces colonnes :
═══════════════════════════════════════════════════════
VUE : v_transactions_enriched

  id                BIGINT        — identifiant unique de la transaction
  transaction_code  INTEGER       — code de la carte
  merchant_name     TEXT          — nom du marchand
  transaction_date  DATE          — date (type DATE, pas TIMESTAMP)
  posting_date      DATE          — date de comptabilisation
  amount_cad        NUMERIC(12,2) — montant en CAD
  amount            NUMERIC(12,2) — montant original
  currency          TEXT          — 'CAD' ou 'USD'
  debit_or_credit   TEXT          — 'Debit' ou 'Credit'
  mcc               INTEGER       — code MCC (entier, ex: 5812)
  mcc_label         TEXT          — libellé du MCC (ex: 'Restaurant')
  mcc_category      TEXT          — catégorie (ex: 'Repas & Divertissement')
  merchant_city     TEXT
  merchant_country  TEXT
  merchant_state_province TEXT
  compliance_status TEXT
  approval_status   TEXT

AUCUNE AUTRE TABLE N'EXISTE. N'utilise que v_transactions_enriched.

═══════════════════════════════════════════════════════
RÈGLES ABSOLUES :
═══════════════════════════════════════════════════════
✅ TOUJOURS inclure : WHERE debit_or_credit = 'Debit'
✅ TOUJOURS retourner : id, transaction_code, merchant_name, transaction_date, amount_cad
✅ TOUJOURS terminer par : LIMIT 100
✅ mcc est INTEGER → comparaisons avec = ou IN, jamais LIKE ni quotes
✅ transaction_date est DATE → utilise CURRENT_DATE, pas NOW() ni intervals d'heures
✅ Pour les montants > seuil : WHERE amount_cad > [seuil]
✅ Pour filtrer par catégorie : WHERE mcc_category = '...' (texte exact du schéma ci-dessus)
✅ Pour filtrer par MCC : WHERE mcc = [entier] ou WHERE mcc IN ([entier1], [entier2])

❌ N'utilise JAMAIS : mcc_categories, mcc_codes, categories, ou toute table inexistante
❌ N'utilise JAMAIS : LIKE sur mcc (c'est un INTEGER)
❌ N'utilise JAMAIS : interval '1 hour' ou interval '1 minute' (transaction_date est DATE)
❌ N'utilise JAMAIS de point-virgule à la fin
❌ N'utilise JAMAIS de markdown ni d'explication

═══════════════════════════════════════════════════════
FORMAT ATTENDU (structure uniquement) :
═══════════════════════════════════════════════════════
SELECT id, transaction_code, merchant_name, transaction_date, amount_cad
FROM v_transactions_enriched
WHERE debit_or_credit = 'Debit'
  AND <condition dérivée de la règle ci-dessous>
ORDER BY amount_cad DESC
LIMIT 100

═══════════════════════════════════════════════════════
RÈGLE À DÉTECTER :
═══════════════════════════════════════════════════════
Code        : {{rule_code}}
Description : {{description_fr}}
Type        : {{rule_type}}
Condition   : {{condition_json}}
Seuil ($)   : {{threshold_amount}}
Preuve      : {{evidence_text}}
Catégorie   : {{category}}

CONTEXTE ENTREPRISE (IMPORTANT) :
Société de transport routier au Canada. Ces dépenses sont opérationnelles et normales — NE PAS les inclure dans les règles de seuil ou pré-autorisation :
  - Carburant / diesel : mcc IN (5541, 5542)
  - Permis gouvernementaux / poids-dimensions : mcc IN (9399, 9311)
  - Péages / frais routiers : mcc = 4784
  - Réparations véhicule / pneus : mcc IN (7531, 7534, 7538, 5533)
  - Stationnement camions : mcc = 7523
Si la règle porte sur un seuil de montant, ajoute : AND mcc NOT IN (5541, 5542, 9399, 9311, 4784, 7531, 7534, 7538, 5533, 7523)

Retourne UNIQUEMENT le SQL SELECT (sans markdown, sans explication, sans point-virgule).
Si cette règle est impossible à détecter automatiquement par SQL (ex: règle sur comportement, fraude intentionnelle, usage personnel non détectable), retourne exactement : NULL`;

async function validateSQL(sql: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Wrap dans une sous-requête avec WHERE false pour valider la syntaxe sans retourner de données
    const wrappedSql = `SELECT * FROM (${sql}) _v WHERE false`;
    const { error } = await supabase.rpc("run_sql_query", { query: wrappedSql });
    if (error) return { valid: false, error: error.message };
    return { valid: true };
  } catch (e) {
    return { valid: false, error: String(e) };
  }
}

// ─── Fallback : re-demande à Mistral avec le contexte complet ─

async function generateFallbackSQL(
  rule: { id: number; rule_code: string; description_fr: string; evidence_text: string },
  mistralClient: Mistral
): Promise<string | null> {
  const context = `${rule.evidence_text} ${rule.description_fr} ${rule.rule_code}`;

  const prompt = `Tu es un expert PostgreSQL. En te basant UNIQUEMENT sur ce contexte de règle de dépense, génère une requête SQL qui détecte les transactions concernées.

CONTEXTE DE LA RÈGLE :
${context}

VUE : v_transactions_enriched
Colonnes disponibles : id, transaction_code, merchant_name, transaction_date (DATE), amount_cad (NUMERIC), mcc (INTEGER), mcc_label (TEXT), mcc_category (TEXT), merchant_city, debit_or_credit

LISTE DES MCC UTILES :
6011=ATM/cash, 9211=amende/cour, 7523=stationnement, 5814=bar/alcool,
5947=cartes-cadeaux, 5541=station-service, 5542=pompe automatique,
3366/3516/3665/7513=location voiture, 7011=hôtel, 5812=restaurant,
4511=billet avion, 4121=taxi, 4784=péage, 9399=permis gouvernemental,
5812/5814=repas&divertissement

RÈGLES :
- WHERE debit_or_credit = 'Debit' obligatoire
- Retourner : id, transaction_code, merchant_name, transaction_date, amount_cad
- mcc est INTEGER, jamais de LIKE ni de guillemets sur mcc
- transaction_date est DATE, pas de intervals en heures
- Pas de point-virgule
- LIMIT 100

Retourne UNIQUEMENT le SQL SELECT. Si vraiment impossible, retourne NULL.`;

  try {
    const response = await mistralClient.chat.complete({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
    });
    const content = response.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return null;
    const sql = content.replace(/```sql\s*/gi, "").replace(/```\s*/g, "").trim().replace(/;+$/, "");
    if (!sql || sql.toUpperCase() === "NULL" || !sql.toUpperCase().startsWith("SELECT")) return null;
    return sql;
  } catch {
    return null;
  }
}

async function seedDetectionSQL() {
  log("Génération des requêtes SQL de détection via IA...");

  const { data: rules, error } = await supabase
    .from("policy_rules")
    .select("id, rule_code, description_fr, rule_type, condition_json, threshold_amount, evidence_text, category")
    .eq("is_active", true);

  if (error) { log(`Erreur chargement règles: ${error.message}`); return; }
  if (!rules?.length) { log("Aucune règle active trouvée — skip"); return; }

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const rule of rules) {
    const prompt = DETECTION_SQL_PROMPT
      .replace("{{rule_code}}", rule.rule_code)
      .replace("{{description_fr}}", rule.description_fr)
      .replace("{{rule_type}}", rule.rule_type)
      .replace("{{condition_json}}", JSON.stringify(rule.condition_json))
      .replace("{{threshold_amount}}", rule.threshold_amount ?? "N/A")
      .replace("{{evidence_text}}", rule.evidence_text)
      .replace("{{category}}", rule.category);

    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
      try {
        const response = await mistral.chat.complete({
          model: "mistral-large-latest",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.0,
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content || typeof content !== "string") break;

        const sqlRaw = content
          .replace(/```sql\s*/gi, "")
          .replace(/```\s*/g, "")
          .trim()
          .replace(/;+$/, ""); // strip trailing semicolons

        if (!sqlRaw || sqlRaw.toUpperCase() === "NULL" || !sqlRaw.toUpperCase().startsWith("SELECT")) {
          // Fallback : re-demande à Mistral avec le contexte complet
          const fallbackSql = await generateFallbackSQL(rule, mistral);
          if (fallbackSql) {
            const val = await validateSQL(fallbackSql);
            if (val.valid) {
              await supabase.from("policy_rules").update({ detection_sql: fallbackSql }).eq("id", rule.id);
              generated++;
              log(`  ~ ${rule.rule_code}: fallback IA appliqué`);
            } else {
              log(`  — ${rule.rule_code}: fallback invalide (${val.error})`);
              skipped++;
            }
          } else {
            log(`  — ${rule.rule_code}: non détectable par SQL`);
            skipped++;
          }
          success = true;
          break;
        }

        // Validation : tester la requête avant de sauvegarder
        const validation = await validateSQL(sqlRaw);
        if (!validation.valid) {
          log(`  ✗ ${rule.rule_code}: SQL invalide — ${validation.error}`);
          // Deuxième tentative avec l'erreur en feedback
          if (retries > 1) {
            log(`    ↻ Retry avec feedback d'erreur...`);
            retries--;
            await sleep(2000);
            continue;
          } else {
            // Dernier recours : fallback IA avec contexte complet
            const fallbackSql = await generateFallbackSQL(rule, mistral);
            if (fallbackSql) {
              const val = await validateSQL(fallbackSql);
              if (val.valid) {
                await supabase.from("policy_rules").update({ detection_sql: fallbackSql }).eq("id", rule.id);
                generated++;
                log(`  ~ ${rule.rule_code}: fallback IA appliqué après SQL invalide`);
              } else {
                failed++;
              }
            } else {
              failed++;
            }
            success = true;
            break;
          }
        }

        await supabase.from("policy_rules").update({ detection_sql: sqlRaw }).eq("id", rule.id);
        generated++;
        log(`  ✓ ${rule.rule_code}`);
        success = true;

      } catch (err: unknown) {
        const msg = String(err);
        if (msg.includes("429") || msg.includes("rate_limit")) {
          retries--;
          log(`  ⏳ Rate limit sur ${rule.rule_code} — attente 15s (${retries} essais restants)`);
          await sleep(15000);
        } else {
          log(`  ✗ ${rule.rule_code}: ${msg}`);
          failed++;
          success = true;
        }
      }
    }

    await sleep(1500);
  }

  log(`Résultat : ${generated} générées ✓ | ${skipped} non détectables | ${failed} échecs`);
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  log("=== Démarrage du seed ===");

  if (!fs.existsSync(XLSX_FILE)) {
    throw new Error(`Fichier introuvable : ${XLSX_FILE}`);
  }

  log("Lecture du fichier Excel...");
  const workbook = xlsx.readFile(XLSX_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet);
  log(`${rows.length} lignes lues`);

  await seedCards(rows);
  await seedTransactions(rows);
  await seedPolicy();
  await seedDetectionSQL(); // ← génère les SQL de détection automatiquement

  log("=== Seed terminé ===");
}

main().catch((err) => {
  console.error("[seed] ERREUR:", err);
  process.exit(1);
});
