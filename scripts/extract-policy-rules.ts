import { Mistral } from "@mistralai/mistralai";
import { EXTRACT_POLICY_RULES_PROMPT, mistral } from "../src/lib/mistral";

export async function extractPolicyRules(policyText: string) {
  const prompt = EXTRACT_POLICY_RULES_PROMPT.replace(
    "{POLICY_TEXT}",
    policyText,
  );

  const response = await mistral.chat.complete({
    model: "mistral-large-latest",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.1,
    responseFormat: {
      type: "json_object",
    },
  });

  const content = response.choices[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Mistral n'a retourné aucune règle.");
  }

  const parsed = JSON.parse(content);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed.rules)) {
    return parsed.rules;
  }

  if (Array.isArray(parsed.policy_rules)) {
    return parsed.policy_rules;
  }

  console.log("Réponse Mistral reçue :", JSON.stringify(parsed, null, 2));

  throw new Error(
    "Impossible de trouver un tableau de règles dans la réponse Mistral.",
  );
}
