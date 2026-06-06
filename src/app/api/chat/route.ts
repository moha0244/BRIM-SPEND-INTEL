// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Mistral } from "@mistralai/mistralai";
import { createClient } from "@supabase/supabase-js";
import { CHAT_TOOLS } from "@/lib/chat-tools";
import { MISTRAL_MODEL, SQL_RPC } from "@/lib/config";

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── Prompt système dynamique ─────────────────────────────────────────────────

interface PromptCache { prompt: string; ts: number }
let _promptCache: PromptCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

async function rpc(query: string) {
  const { data } = await supabase.rpc(SQL_RPC, { query });
  return (data ?? []) as Record<string, unknown>[];
}

async function buildSystemPrompt(): Promise<string> {
  if (_promptCache && Date.now() - _promptCache.ts < CACHE_TTL_MS) {
    return _promptCache.prompt;
  }

  try {
    const [overview, cards, topMCC] = await Promise.all([
      rpc(`SELECT COUNT(*)::integer AS nb, SUM(amount_cad)::numeric AS total,
                MIN(transaction_date)::text AS date_min, MAX(transaction_date)::text AS date_max
           FROM v_transactions_enriched WHERE debit_or_credit = 'Debit'`),
      rpc(`SELECT transaction_code, card_label, COUNT(*)::integer AS nb, SUM(amount_cad)::numeric AS total
           FROM v_transactions_enriched WHERE debit_or_credit = 'Debit'
           GROUP BY transaction_code, card_label ORDER BY total DESC`),
      rpc(`SELECT mcc, mcc_label, COUNT(*)::integer AS nb
           FROM v_transactions_enriched WHERE debit_or_credit = 'Debit'
           GROUP BY mcc, mcc_label ORDER BY nb DESC LIMIT 8`),
    ]);

    const ov = overview[0] ?? {};
    const nb = Number(ov.nb ?? 0).toLocaleString("fr-CA");
    const total = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(Number(ov.total ?? 0));
    const dateMin = String(ov.date_min ?? "").slice(0, 7);
    const dateMax = String(ov.date_max ?? "").slice(0, 7);
    const cardCodes = cards.map(c => c.transaction_code).join(", ");
    const topCard = cards[0];
    const cardsDetail = cards.map(c =>
      `  - Carte ${c.transaction_code} (${c.card_label ?? ""}): ${Number(c.nb).toLocaleString("fr-CA")} txns, ${new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(Number(c.total ?? 0))}`
    ).join("\n");
    const mccLines = topMCC.map(m =>
      `  - ${m.mcc} : ${m.mcc_label} (${Number(m.nb).toLocaleString("fr-CA")} txns)`
    ).join("\n");

    const prompt = `Tu es un analyste financier IA pour une entreprise de transport routier (camionnage).
Tu analyses les dépenses corporatives via leurs cartes de crédit Brim.

CONTEXTE (données réelles depuis la base) :
- Période : ${dateMin} → ${dateMax}
- ${nb} transactions · Total débité : ${total}
- ${cards.length} cartes : ${cardCodes}
- Carte principale : ${topCard?.transaction_code} (${Number(topCard?.nb ?? 0).toLocaleString("fr-CA")} txns)
Détail par carte :
${cardsDetail}

TOP MCC (par volume) :
${mccLines}`;

    _promptCache = { prompt: prompt + SYSTEM_PROMPT_STATIC, ts: Date.now() };
    return _promptCache.prompt;
  } catch {
    return "Tu es un analyste financier IA." + SYSTEM_PROMPT_STATIC;
  }
}

const SYSTEM_PROMPT_STATIC = `

SCHÉMA EXACT DE LA BASE :

VUE PRINCIPALE — v_transactions_enriched (utilise TOUJOURS cette vue pour les analyses) :
  id, transaction_code INTEGER, card_label TEXT,
  transaction_date DATE, posting_date DATE,
  merchant_name TEXT, transaction_description TEXT,
  amount NUMERIC, currency TEXT, amount_cad NUMERIC,
  debit_or_credit TEXT ('Debit'|'Credit'),
  mcc INTEGER,           ← merchant_category_code (INTEGER, SANS guillemets)
  mcc_label TEXT,        ← label lisible ex: 'Carburant', 'Permis gouvernementaux'
  mcc_category TEXT,     ← catégorie regroupée ex: 'Transport', 'Véhicule'
  merchant_city TEXT, merchant_country TEXT, merchant_state_province TEXT,
  compliance_status TEXT, approval_status TEXT, created_at TIMESTAMPTZ

AUTRES TABLES (pour conformité/approbations) :
  cards : code INTEGER PK, label TEXT, card_type TEXT
  transactions : table brute (préfère v_transactions_enriched)
  policy_rules : id, rule_code TEXT, category, description_fr, severity, action, evidence_text
  compliance_violations : id, transaction_id, rule_id, severity, ai_explanation, status, detected_at
  approval_requests : id, transaction_id, ai_recommendation, ai_reasoning, decision, created_at
  expense_reports : id, report_name, transaction_code, date_start, date_end, total_amount_cad, status

RÈGLES SQL ABSOLUES :
1. mcc est INTEGER dans v_transactions_enriched — JAMAIS de guillemets
   BON:    WHERE mcc IN (5541, 5542)
   MAUVAIS: WHERE mcc IN ('5541', '5542')
2. Pour catégories : utilise mcc_category ou mcc_label directement — pas besoin de JOIN
   BON:    GROUP BY mcc_category
   BON:    GROUP BY mcc_label
3. transaction_code est INTEGER : WHERE transaction_code = 3001
4. Filtre TOUJOURS debit_or_credit = 'Debit' sauf si crédits demandés
5. GROUP BY : JAMAIS sur un alias calculé — répète l'expression
   BON:    GROUP BY TO_CHAR(transaction_date, 'YYYY-MM')
   MAUVAIS: GROUP BY month
6. ORDER BY sur alias calculé : utilise numéro de position → ORDER BY 1
7. amount_cad est NUMERIC calculé — prêt à l'emploi, pas de CAST
8. LIMIT 100 maximum

COMPORTEMENT :
- Réponds TOUJOURS en français
- Ne suppose jamais les chiffres — utilise les tools
- Si erreur SQL → corrige et relance immédiatement sans demander à l'utilisateur
- Contexte de conversation mémorisé pour questions de suivi
- Montants toujours en $ CAD
- JAMAIS inclure les requêtes SQL, les appels de tools ou du JSON dans ta réponse textuelle
- Pour les comparaisons (ex: carburant vs péages), fais UNE SEULE requête SQL qui retourne les deux catégories dans le même résultat avec UNION ALL ou GROUP BY — pas deux requêtes séparées

WORKFLOW OBLIGATOIRE pour toute question de données :
1. Appelle query_transactions(sql) pour obtenir les données
2. Appelle OBLIGATOIREMENT render_chart() après avoir vu les données — TOUJOURS, sans exception
   - 'number' → si la requête retourne 1 ligne avec 1-3 valeurs scalaires
   - 'bar'    → pour comparer des marchands, catégories, cartes
   - 'line'   → pour une évolution par mois (GROUP BY mois)
   - 'pie'    → pour montrer des parts/répartitions (max 6 catégories)
   - 'table'  → pour les listes détaillées avec beaucoup de colonnes
3. Rédige ta réponse textuelle en français naturel — SANS tableau markdown, SANS JSON, SANS SQL

NE JAMAIS utiliser de tableaux markdown (|col|col|) dans ta réponse texte — les données sont déjà affichées via render_chart.`;

// ─── Exécution des tools ─────────────────────────────────────────────────────

// Auto-correction des erreurs SQL fréquentes de l'IA
function autoFixSQL(sql: string): string {
  let fixed = sql;

  // 1. MCC entre guillemets → entiers
  // Ex: mcc IN ('5541', '5542') → mcc IN (5541, 5542)
  fixed = fixed.replace(
    /\b(mcc|merchant_category_code)\s*(=\s*'(\d+)'|IN\s*\(([^)]+)\))/gi,
    (_match, col, rest) => {
      const eqMatch = rest.match(/^=\s*'(\d+)'$/);
      if (eqMatch) return `${col} = ${eqMatch[1]}`;
      const inMatch = rest.match(/^IN\s*\(([^)]+)\)$/i);
      if (inMatch) {
        const cleaned = inMatch[1].replace(/'(\d+)'/g, "$1");
        return `${col} IN (${cleaned})`;
      }
      return `${col} ${rest}`;
    },
  );

  // 2. GROUP BY alias → GROUP BY expression complète
  // PostgreSQL n'accepte pas les alias dans GROUP BY
  // Ex: SELECT TO_CHAR(d, 'YYYY-MM') AS month ... GROUP BY month
  //   → GROUP BY TO_CHAR(d, 'YYYY-MM')
  fixed = fixed.replace(
    /SELECT\s+([\s\S]+?)\s+FROM/i,
    (selectClause) => selectClause, // on garde le SELECT intact
  );

  // Remplacement ciblé : GROUP BY <alias_simple> quand l'alias vient d'un TO_CHAR
  // Pattern: GROUP BY month (alias seul, pas une expression)
  fixed = fixed.replace(
    /GROUP\s+BY\s+(\w+)(?=\s*(?:ORDER|LIMIT|HAVING|$|;))/gi,
    (_match, alias) => {
      // Cherche si cet alias est défini comme TO_CHAR(...) AS alias dans le SELECT
      const toCharPattern = new RegExp(
        `TO_CHAR\\([^)]+\\)\\s+AS\\s+${alias}\\b`,
        "i",
      );
      const exprPattern = new RegExp(
        `(TO_CHAR\\([^)]+\\))\\s+AS\\s+${alias}\\b`,
        "i",
      );
      const match = fixed.match(exprPattern);
      if (match) {
        return `GROUP BY ${match[1]}`;
      }
      // Cherche d'autres expressions avec alias
      const genericPattern = new RegExp(
        `([\\w.(),' ]+?)\\s+AS\\s+${alias}\\b`,
        "i",
      );
      const gMatch = fixed.match(genericPattern);
      if (gMatch && gMatch[1].trim() !== alias) {
        return `GROUP BY ${gMatch[1].trim()}`;
      }
      return `GROUP BY ${alias}`;
    },
  );

  return fixed;
}

async function executeQueryTransactions(args: {
  sql: string;
  chart_type: string;
  chart_title: string;
  x_axis?: string;
  y_axis?: string;
}) {
  const rawSql = args.sql.trim();
  if (
    !rawSql.toUpperCase().startsWith("SELECT") &&
    !rawSql.toUpperCase().startsWith("WITH")
  ) {
    return { error: "Seules les requêtes SELECT sont autorisées." };
  }

  const sql = autoFixSQL(rawSql);
  const { data, error } = await supabase.rpc(SQL_RPC, { query: sql });

  if (error) {
    return { error: `Erreur SQL: ${error.message}`, sql_attempted: sql };
  }

  return {
    data,
    row_count: Array.isArray(data) ? data.length : 0,
    chart_type: args.chart_type,
    chart_title: args.chart_title,
    x_axis: args.x_axis,
    y_axis: args.y_axis,
  };
}

async function executeGetCardSummary(args: {
  card_code?: number;
  period_start?: string;
  period_end?: string;
}) {
  // Dates par défaut : plage réelle depuis la DB
  let start = args.period_start;
  let end = args.period_end;
  if (!start || !end) {
    const range = await rpc(`SELECT MIN(transaction_date)::text AS d_min, MAX(transaction_date)::text AS d_max
      FROM v_transactions_enriched WHERE debit_or_credit = 'Debit'`);
    start = start ?? String(range[0]?.d_min ?? "").slice(0, 10);
    end = end ?? String(range[0]?.d_max ?? "").slice(0, 10);
  }
  const cardFilter = args.card_code
    ? `AND transaction_code = ${args.card_code}`
    : "";

  const [totals, topMerchants, topCategories] = await Promise.all([
    supabase.rpc(SQL_RPC, {
      query: `
        SELECT
          transaction_code,
          COUNT(*) AS nb_transactions,
          SUM(amount_cad) AS total_cad,
          AVG(amount_cad) AS avg_cad,
          MIN(transaction_date) AS first_txn,
          MAX(transaction_date) AS last_txn
        FROM transactions
        WHERE debit_or_credit = 'Debit'
          AND transaction_date BETWEEN '${start}' AND '${end}'
          ${cardFilter}
        GROUP BY transaction_code
        ORDER BY total_cad DESC
      `,
    }),
    supabase.rpc(SQL_RPC, {
      query: `
        SELECT merchant_name, COUNT(*) AS nb, SUM(amount_cad) AS total
        FROM transactions
        WHERE debit_or_credit = 'Debit'
          AND transaction_date BETWEEN '${start}' AND '${end}'
          ${cardFilter}
        GROUP BY merchant_name
        ORDER BY total DESC
        LIMIT 10
      `,
    }),
    supabase.rpc(SQL_RPC, {
      query: `
        SELECT
          merchant_category_code AS mcc,
          COUNT(*) AS nb,
          SUM(amount_cad) AS total
        FROM transactions
        WHERE debit_or_credit = 'Debit'
          AND transaction_date BETWEEN '${start}' AND '${end}'
          ${cardFilter}
        GROUP BY merchant_category_code
        ORDER BY total DESC
        LIMIT 8
      `,
    }),
  ]);

  return {
    totals: totals.data,
    top_merchants: topMerchants.data,
    top_categories: topCategories.data,
    period: { start, end },
    chart_type: "bar",
    chart_title: args.card_code
      ? `Résumé carte ${args.card_code}`
      : "Résumé toutes les cartes",
  };
}

async function executeDetectAnomalies(args: {
  card_code?: number;
  anomaly_type: string;
}) {
  const cardFilter = args.card_code
    ? `AND transaction_code = ${args.card_code}`
    : "";
  const results: Record<string, unknown> = {};

  if (
    args.anomaly_type === "split_transactions" ||
    args.anomaly_type === "all"
  ) {
    // Transactions très proches dans le temps, même carte, même marchand
    const { data } = await supabase.rpc(SQL_RPC, {
      query: `
        SELECT
          t1.transaction_code,
          t1.merchant_name,
          t1.transaction_date AS date1,
          t1.amount AS amount1,
          t2.transaction_date AS date2,
          t2.amount AS amount2,
          (t1.amount_cad + t2.amount_cad) AS total_combine
        FROM transactions t1
        JOIN transactions t2 ON
          t1.transaction_code = t2.transaction_code
          AND t1.merchant_name = t2.merchant_name
          AND t1.id < t2.id
          AND ABS(t1.transaction_date - t2.transaction_date) <= 3
          AND t1.debit_or_credit = 'Debit'
          AND t2.debit_or_credit = 'Debit'
        WHERE (t1.amount_cad + t2.amount_cad) > 50
          AND t1.amount_cad < 50
          AND t2.amount_cad < 50
          ${cardFilter.replace("transaction_code", "t1.transaction_code")}
        ORDER BY total_combine DESC
        LIMIT 20
      `,
    });
    results.split_transactions = data;
  }

  if (args.anomaly_type === "unusual_amounts" || args.anomaly_type === "all") {
    // Montants très supérieurs à la moyenne par marchand
    const { data } = await supabase.rpc(SQL_RPC, {
      query: `
        WITH merchant_stats AS (
          SELECT
            merchant_name,
            AVG(amount_cad) AS avg_amount,
            STDDEV(amount_cad) AS std_amount,
            COUNT(*) AS nb
          FROM transactions
          WHERE debit_or_credit = 'Debit' ${cardFilter}
          GROUP BY merchant_name
          HAVING COUNT(*) >= 3
        )
        SELECT
          t.transaction_code,
          t.merchant_name,
          t.transaction_date,
          t.amount_cad,
          ms.avg_amount,
          ROUND((t.amount_cad - ms.avg_amount) / NULLIF(ms.std_amount, 0), 1) AS z_score
        FROM transactions t
        JOIN merchant_stats ms ON ms.merchant_name = t.merchant_name
        WHERE t.debit_or_credit = 'Debit'
          AND ms.std_amount > 0
          AND (t.amount_cad - ms.avg_amount) / ms.std_amount > 2.5
          ${cardFilter}
        ORDER BY z_score DESC
        LIMIT 15
      `,
    });
    results.unusual_amounts = data;
  }

  if (args.anomaly_type === "spending_spikes" || args.anomaly_type === "all") {
    const { data } = await supabase.rpc(SQL_RPC, {
      query: `
        SELECT
          TO_CHAR(transaction_date, 'YYYY-MM') AS month,
          transaction_code,
          COUNT(*) AS nb_transactions,
          SUM(amount_cad) AS total_cad
        FROM transactions
        WHERE debit_or_credit = 'Debit' ${cardFilter}
        GROUP BY TO_CHAR(transaction_date, 'YYYY-MM'), transaction_code
        ORDER BY total_cad DESC
        LIMIT 10
      `,
    });
    results.spending_spikes = data;
  }

  return {
    anomaly_type: args.anomaly_type,
    results,
    chart_type: "table",
    chart_title: "Anomalies détectées",
  };
}

// ─── Dispatcher de tools ──────────────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "query_transactions":
      return executeQueryTransactions(
        args as Parameters<typeof executeQueryTransactions>[0],
      );
    case "get_card_summary":
      return executeGetCardSummary(
        args as Parameters<typeof executeGetCardSummary>[0],
      );
    case "detect_anomalies":
      return executeDetectAnomalies(
        args as Parameters<typeof executeDetectAnomalies>[0],
      );
    default:
      return { error: `Tool inconnu : ${name}` };
  }
}

// ─── Route principale ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages invalides" },
        { status: 400 },
      );
    }

    // Construire l'historique pour Mistral
    const systemPrompt = await buildSystemPrompt();
    const mistralMessages: Array<{
      role: string;
      content: string | unknown[];
    }> = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // Premier appel Mistral avec retry sur rate limit
    async function callMistral(params: Parameters<typeof mistral.chat.complete>[0], retries = 3): Promise<Awaited<ReturnType<typeof mistral.chat.complete>>> {
      try {
        return await mistral.chat.complete(params);
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status ?? (err as { rawResponse?: { status?: number } })?.rawResponse?.status;
        if (status === 429 && retries > 0) {
          await new Promise(r => setTimeout(r, 15000)); // attendre 15s
          return callMistral(params, retries - 1);
        }
        throw err;
      }
    }

    let response = await callMistral({
      model: MISTRAL_MODEL,
      messages: mistralMessages as Parameters<
        typeof mistral.chat.complete
      >[0]["messages"],
      tools: CHAT_TOOLS,
      toolChoice: "auto",
      temperature: 0.2,
    });

    let message = response.choices?.[0]?.message;
    let chartData: unknown = null;
    const toolCallsExecuted: unknown[] = [];

    // Boucle d'exécution des tools
    while (message?.toolCalls && message.toolCalls.length > 0) {
      const toolResults = [];

      for (const toolCall of message.toolCalls) {
        const args =
          typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;

        const result = await executeTool(toolCall.function.name, args);

        // Capturer chartData si le résultat contient chart_type
        if (result && "chart_type" in result && result.chart_type !== "none") {
          chartData = result;
        }

        toolCallsExecuted.push({ name: toolCall.function.name, args, result });
        toolResults.push({
          role: "tool" as const,
          toolCallId: toolCall.id,
          content: JSON.stringify(result),
        });
      }

      // Renvoyer les résultats à Mistral et demander une réponse textuelle
      const updatedMessages = [
        ...mistralMessages,
        { role: "assistant" as const, content: message.content ?? "", toolCalls: message.toolCalls },
        ...toolResults,
        { role: "user" as const, content: "Maintenant réponds en français naturel avec les chiffres clés. Sois concis et direct. N'inclus aucun JSON ni SQL." },
      ];

      response = await callMistral({
        model: MISTRAL_MODEL,
        messages: updatedMessages as Parameters<typeof mistral.chat.complete>[0]["messages"],
        tools: CHAT_TOOLS,
        toolChoice: "none",
        temperature: 0.3,
      });

      message = response.choices?.[0]?.message;
    }

    let rawContent =
      typeof message?.content === "string"
        ? message.content
        : Array.isArray(message?.content)
          ? message.content.map((c: { text?: string }) => c.text ?? "").join("")
          : "Je n'ai pas pu générer de réponse.";

    // Nettoyage minimal — supprimer seulement les blocs de code et JSON évidents
    const cleanContent = rawContent
      .replace(/```[\s\S]*?```/g, "")
      .replace(/^\s*\{[\s\S]*?"sql"[\s\S]*?\}\s*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return NextResponse.json({
      content: cleanContent || "Analyse terminée.",
      chartData,
      toolCallsExecuted: toolCallsExecuted.length,
    });
  } catch (error) {
    console.error("[Chat API Error]", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 },
    );
  }
}
