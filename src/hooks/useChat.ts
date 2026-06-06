// src/hooks/useChat.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface ChartData {
  chart_type: "bar" | "line" | "pie" | "table" | "number" | "none";
  chart_title: string;
  x_axis?: string;
  y_axis?: string;
  // Toutes les formes possibles de données retournées par l'API
  data?: Record<string, unknown>[];
  totals?: Record<string, unknown>[];
  top_merchants?: Record<string, unknown>[];
  top_categories?: Record<string, unknown>[];
  results?: Record<string, unknown>;
  row_count?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  chartData?: ChartData | null;
  timestamp: Date;
  isLoading?: boolean;
}

const WELCOME_FALLBACK = "Bonjour ! Je suis votre analyste financier IA. Posez-moi vos questions sur les dépenses corporatives.";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: WELCOME_FALLBACK, timestamp: new Date() },
  ]);

  // Remplacer le message de bienvenue par des stats réelles depuis le dashboard
  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then((data) => {
        const kpis = data?.kpis;
        if (!kpis) return;
        const nb = Number(kpis.totalTransactions ?? 0).toLocaleString("fr-CA");
        const total = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(Number(kpis.totalSpend ?? 0));
        const dateMin = String(kpis.dateMin ?? "").slice(0, 7);
        const dateMax = String(kpis.dateMax ?? "").slice(0, 7);
        const content = `Bonjour ! Je suis votre analyste financier IA. J'ai accès à **${nb} transactions** pour un total de **${total}** (${dateMin} → ${dateMax}).\n\nVous pouvez me demander :\n- « Dépenses totales par mois ? »\n- « Top 10 marchands par montant »\n- « Carburant vs péages — comparaison »\n- « Y a-t-il des anomalies ? »`;
        setMessages([{ id: "welcome", role: "assistant", content, timestamp: new Date() }]);
      })
      .catch(() => {}); // fallback silencieux sur le message par défaut
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userInput: string) => {
      if (!userInput.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: userInput.trim(),
        timestamp: new Date(),
      };

      const loadingMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isLoading: true,
      };

      setMessages((prev) => [...prev, userMessage, loadingMessage]);
      setIsLoading(true);

      try {
        abortRef.current = new AbortController();

        const history = [...messages, userMessage]
          .filter((m) => m.id !== "welcome" && !m.isLoading)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        // Log pour debug — visible dans F12 > Console
        console.log("[Chat API response]", data);
        if (data.chartData) {
          console.log("[chartData]", JSON.stringify(data.chartData, null, 2));
        }

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            data.content ?? "Désolé, je n'ai pas pu générer une réponse.",
          chartData: data.chartData ?? null,
          timestamp: new Date(),
        };

        setMessages((prev) => {
          const withoutLoading = prev.filter((m) => !m.isLoading);
          return [...withoutLoading, assistantMessage];
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;

        setMessages((prev) => {
          const withoutLoading = prev.filter((m) => !m.isLoading);
          return [
            ...withoutLoading,
            {
              id: crypto.randomUUID(),
              role: "assistant" as const,
              content:
                "Une erreur est survenue. Vérifiez votre connexion et réessayez.",
              timestamp: new Date(),
            },
          ];
        });
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading],
  );

  const clearHistory = useCallback(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Conversation réinitialisée. Comment puis-je vous aider ?",
        timestamp: new Date(),
      },
    ]);
  }, []);

  return { messages, sendMessage, isLoading, clearHistory };
}
