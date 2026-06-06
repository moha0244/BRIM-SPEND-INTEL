// src/components/chat/ChatInterface.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";
import ChartRenderer from "./ChartRenderer";
import { MessageBubble } from "./MessageBubble";
import { Send, RotateCcw, Loader2 } from "lucide-react";

const MONO = "'IBM Plex Mono', monospace";

const SUGGESTIONS = [
  "Quel est le total des dépenses ce trimestre ?",
  "Quelles cartes ont le plus de violations ?",
  "Résume les transactions en attente d'approbation.",
  "Quel est le marchand le plus fréquent ?",
];

export default function ChatInterface() {
  const { messages, sendMessage, isLoading, clearHistory } = useChat();
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFirstMessage = messages.length <= 1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
    inputRef.current?.focus();
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "#080C12",
      fontFamily: "Inter, sans-serif",
      overflow: "hidden",
    }}>

      {/* Zone messages — scrollable */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 12px" }}>

        {/* Message de bienvenue — toujours visible */}
        <div style={{
            background: "#0B1120",
            border: "1px solid #1a2236",
            borderRadius: 10,
            padding: "12px 18px",
            fontSize: 13,
            color: "#C8D3E5",
            lineHeight: 1.6,
            marginBottom: 16,
            maxWidth: 560,
          }}>
            Bonjour ! Je suis l'assistant IA de Brim Finance. Posez-moi vos questions sur les transactions, la conformité ou les rapports.
          </div>

        {/* Liste des messages */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {messages
            .filter((m) => m.id !== "welcome")
            .map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 6 }}>
                  {msg.isLoading ? (
                    <div style={{
                      background: "#0B1120",
                      border: "1px solid #1a2236",
                      borderRadius: "10px 10px 10px 2px",
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: "#3A4A6A",
                      fontFamily: MONO,
                    }}>
                      <Loader2 size={12} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                      Analyse en cours...
                    </div>
                  ) : (
                    <div style={{
                      background: msg.role === "user" ? "#001f12" : "#0B1120",
                      border: `1px solid ${msg.role === "user" ? "#003d22" : "#1a2236"}`,
                      borderRadius: msg.role === "user"
                        ? "10px 10px 2px 10px"
                        : "10px 10px 10px 2px",
                      padding: "10px 14px",
                      fontSize: 13,
                      color: msg.role === "user" ? "#a0f0c8" : "#C8D3E5",
                      lineHeight: 1.7,
                    }}>
                      {msg.role === "user"
                        ? msg.content
                        : <MessageBubble>{msg.content}</MessageBubble>
                      }
                    </div>
                  )}

                  {msg.chartData && msg.chartData.chart_type !== "none" && (
                    <ChartRenderer chartData={msg.chartData} />
                  )}

                  {!msg.isLoading && (
                    <p style={{
                      fontSize: 9,
                      color: "#2A3A55",
                      fontFamily: MONO,
                      textAlign: msg.role === "user" ? "right" : "left",
                    }}>
                      {msg.timestamp.toLocaleTimeString("fr-CA", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Zone input — fixée en bas */}
      <div style={{
        flexShrink: 0,
        borderTop: "1px solid #1a2236",
        background: "#080C12",
        padding: "12px 24px 20px",
      }}>
        {/* Suggestions */}
        {isFirstMessage && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                disabled={isLoading}
                onClick={() => { if (!isLoading) sendMessage(s); }}
                style={{
                  background: "transparent",
                  border: "1px solid #1a2236",
                  borderRadius: 99,
                  padding: "5px 14px",
                  fontSize: 11,
                  color: "#4A5A7A",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#2a3a55";
                  e.currentTarget.style.color = "#8A9AB8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#1a2236";
                  e.currentTarget.style.color = "#4A5A7A";
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Posez une question sur vos données..."
            disabled={isLoading}
            style={{
              flex: 1,
              background: "#0B1120",
              border: `1px solid ${focused ? "#3b6aff" : "#1a2236"}`,
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13,
              color: "#E8EDF5",
              fontFamily: "Inter, sans-serif",
              outline: "none",
              opacity: isLoading ? 0.6 : 1,
              transition: "border-color 0.12s",
            }}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isLoading}
            style={{
              background: !input.trim() || isLoading ? "#0F1A2E" : "#3b6aff",
              color: !input.trim() || isLoading ? "#2A3A55" : "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              cursor: !input.trim() || isLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.12s",
            }}
          >
            {isLoading
              ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              : <Send size={16} />
            }
          </button>
          <button
            onClick={clearHistory}
            title="Réinitialiser"
            style={{
              background: "transparent",
              border: "1px solid #1a2236",
              borderRadius: 8,
              padding: "10px 12px",
              color: "#3A4A6A",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#2a3a55";
              e.currentTarget.style.color = "#8A9AB8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#1a2236";
              e.currentTarget.style.color = "#3A4A6A";
            }}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #1a2236; border-radius: 2px; }
      `}</style>
    </div>
  );
}
