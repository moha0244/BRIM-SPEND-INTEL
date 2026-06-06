// src/lib/chat-tools.ts
export const CHAT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "query_transactions",
      description:
        "Exécute une requête SQL sur la base Brim et retourne les données avec la visualisation à afficher. " +
        "Utilise cette fonction pour toute question sur les montants, marchands, catégories ou périodes.",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: `Requête SQL PostgreSQL valide sur la base Brim.

VUE PRINCIPALE : v_transactions_enriched
  id, transaction_code (INTEGER), card_label (TEXT),
  transaction_date (DATE), merchant_name (TEXT),
  amount (NUMERIC), currency (TEXT), amount_cad (NUMERIC),
  debit_or_credit (TEXT: 'Debit' ou 'Credit'),
  mcc (INTEGER), mcc_label (TEXT), mcc_category (TEXT),
  merchant_city, merchant_country, compliance_status, approval_status

RÈGLES CRITIQUES :
- mcc est INTEGER → WHERE mcc IN (5541, 5542) jamais avec guillemets
- GROUP BY : jamais sur alias → répète l'expression complète
- ORDER BY alias calculé → utilise numéro de position
- Filtre TOUJOURS debit_or_credit = 'Debit' sauf si crédits demandés
- LIMIT 100 maximum`,
          },
          chart_type: {
            type: "string",
            enum: ["bar", "line", "pie", "table", "number", "none"],
            description:
              "'number' pour 1-2 valeurs scalaires, 'bar' pour comparer des catégories/marchands, " +
              "'line' pour évolution temporelle, 'pie' pour répartition, 'table' pour liste détaillée.",
          },
          chart_title: {
            type: "string",
            description: "Titre court pour le graphique (ex: 'Dépenses carburant par mois')",
          },
          x_axis: {
            type: "string",
            description: "Nom de la colonne SQL pour l'axe X / les labels",
          },
          y_axis: {
            type: "string",
            description: "Nom de la colonne SQL pour les valeurs numériques",
          },
        },
        required: ["sql", "chart_type", "chart_title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_card_summary",
      description:
        "Retourne un résumé complet pour une ou toutes les cartes : total, transactions, top marchands, top catégories.",
      parameters: {
        type: "object",
        properties: {
          card_code: {
            type: "number",
            description: "Code numérique de la carte (transaction_code). Omets pour toutes les cartes.",
          },
          period_start: { type: "string", description: "Date début (YYYY-MM-DD). Omets pour utiliser la date minimale réelle." },
          period_end: { type: "string", description: "Date fin (YYYY-MM-DD). Omets pour utiliser la date maximale réelle." },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "detect_anomalies",
      description: "Détecte les anomalies dans les transactions : transactions fractionnées, montants inhabituels, pics de dépenses.",
      parameters: {
        type: "object",
        properties: {
          card_code: { type: "number", description: "Filtrer sur une carte spécifique (optionnel)" },
          anomaly_type: {
            type: "string",
            enum: ["split_transactions", "unusual_amounts", "spending_spikes", "all"],
            description: "Type d'anomalie à détecter",
          },
        },
        required: ["anomaly_type"],
      },
    },
  },
];

export const MCC_LABELS: Record<number, string> = {
  9399: "Permis gouvernementaux", 5541: "Carburant", 5542: "Carburant (distributeur)",
  4784: "Péages", 7542: "Lave-auto", 4816: "Services en ligne",
  5046: "Pièces & équipement", 5533: "Pièces auto", 7538: "Réparation auto",
  4121: "Transport/Taxi", 7399: "Services entreprise", 5734: "Logiciels",
  5814: "Restaurant", 5812: "Restaurant", 7011: "Hôtel", 5411: "Épicerie",
  5085: "Fournitures industrielles", 4215: "Livraison", 6011: "Retrait ATM",
  5947: "Cartes-cadeaux", 9211: "Amende/Cour",
};
