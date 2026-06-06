// src/lib/mistral.ts
// Instance Mistral partagée + prompts réutilisables

import { Mistral } from "@mistralai/mistralai";

export const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

export const EXTRACT_POLICY_RULES_PROMPT = `Tu es un expert en conformité des dépenses d'entreprise.
Analyse le texte de politique suivant et extrait toutes les règles de dépenses sous forme de tableau JSON.

POLITIQUE :
{POLICY_TEXT}

Pour chaque règle identifiée, retourne un objet avec :
- rule_code : identifiant court en MAJUSCULES_UNDERSCORE (ex: MEAL_LIMIT_50)
- category : catégorie (ex: Repas, Transport, Hébergement, Divertissement, Général)
- description_fr : description claire de la règle en français
- severity : "critical" | "high" | "medium" | "low"
- action : "flag" si c'est une vraie violation à détecter, "info" si c'est juste informatif
- evidence_text : citation exacte du texte de politique qui justifie la règle (en anglais, tel quel)
- threshold_amount : montant seuil en CAD si applicable (nombre), sinon null
- condition_json : objet JSON décrivant la condition (ex: {"max_amount": 50})

Réponds uniquement avec un JSON valide :
{ "rules": [ ... ] }`;
