// src/components/chat/MessageBubble.tsx
// Renderer markdown léger — tables, headers, bold, listes — sans dépendance externe
"use client";

import React from "react";

const ACCENT = "#00F5A0";
const TEXT = "#E8EDF5";
const MUTED = "#8A9AB8";
const DIM = "#3A4A6A";
const BORDER = "#1a2236";
const MONO = "'IBM Plex Mono', monospace";

// ─── Table markdown ───────────────────────────────────────────────────────────

function MarkdownTable({ lines }: { lines: string[] }) {
  const rows = lines
    .filter((l) => !l.match(/^\|[-| :]+\|$/)) // exclure la ligne séparatrice
    .map((l) =>
      l
        .replace(/^\||\|$/g, "") // enlever | début/fin
        .split("|")
        .map((cell) => cell.trim()),
    );

  if (rows.length === 0) return null;
  const [header, ...body] = rows;

  return (
    <div style={{ overflowX: "auto", margin: "8px 0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
            {header.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: "left",
                  padding: "5px 10px",
                  fontSize: 9,
                  color: DIM,
                  fontWeight: 400,
                  fontFamily: MONO,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
              {row.map((cell, j) => {
                const isNum = /^[\d\s,.$%]+$/.test(cell.trim()) && j > 0;
                const isMoney =
                  cell.includes("$") || cell.includes("CAD");
                return (
                  <td
                    key={j}
                    style={{
                      padding: "7px 10px",
                      fontSize: 12,
                      fontFamily: j === 0 ? "inherit" : MONO,
                      color: isMoney ? ACCENT : isNum ? TEXT : MUTED,
                      textAlign: isNum ? "right" : "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cell || "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Inline styles (bold, accents) ───────────────────────────────────────────

function InlineText({ text }: { text: string }) {
  // **bold** → span accent, puis *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <span key={i} style={{ color: ACCENT, fontWeight: 600 }}>
              {part.slice(2, -2)}
            </span>
          );
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return (
            <em key={i} style={{ color: MUTED }}>
              {part.slice(1, -1)}
            </em>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── Parser principal ─────────────────────────────────────────────────────────

function parseMarkdown(raw: string): React.ReactNode[] {
  const lines = raw.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table : blocs de lignes commençant par |
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      nodes.push(<MarkdownTable key={`table-${i}`} lines={tableLines} />);
      continue;
    }

    // ### H3
    if (line.startsWith("### ")) {
      nodes.push(
        <p
          key={i}
          style={{
            fontSize: 11,
            color: ACCENT,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginTop: 14,
            marginBottom: 4,
            fontFamily: MONO,
          }}
        >
          {line.slice(4)}
        </p>,
      );
      i++;
      continue;
    }

    // ## H2
    if (line.startsWith("## ")) {
      nodes.push(
        <p
          key={i}
          style={{
            fontSize: 13,
            color: ACCENT,
            fontWeight: 600,
            marginTop: 14,
            marginBottom: 4,
          }}
        >
          {line.slice(3)}
        </p>,
      );
      i++;
      continue;
    }

    // # H1
    if (line.startsWith("# ")) {
      nodes.push(
        <p
          key={i}
          style={{ fontSize: 15, color: TEXT, fontWeight: 600, marginTop: 12 }}
        >
          {line.slice(2)}
        </p>,
      );
      i++;
      continue;
    }

    // Ligne vide
    if (line.trim() === "") {
      nodes.push(<div key={i} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // Séparateur ---
    if (line.match(/^-{3,}$/)) {
      nodes.push(
        <hr
          key={i}
          style={{ border: "none", borderTop: `1px solid ${BORDER}`, margin: "8px 0" }}
        />,
      );
      i++;
      continue;
    }

    // Listes numérotées : "1. " ou "- "
    if (line.match(/^\d+\.\s/) || line.match(/^[-•]\s/)) {
      const listLines: string[] = [];
      while (
        i < lines.length &&
        (lines[i].match(/^\d+\.\s/) || lines[i].match(/^[-•]\s/))
      ) {
        listLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <div key={`list-${i}`} style={{ margin: "4px 0" }}>
          {listLines.map((ll, j) => {
            const text = ll.replace(/^(\d+\.|[-•])\s/, "");
            return (
              <div
                key={j}
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 3,
                  fontSize: 13,
                  color: TEXT,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ color: DIM, fontFamily: MONO, fontSize: 11, minWidth: 14 }}>
                  {ll.match(/^(\d+)\./)
                    ? ll.match(/^(\d+)\./)?.[1] + "."
                    : "·"}
                </span>
                <InlineText text={text} />
              </div>
            );
          })}
        </div>,
      );
      continue;
    }

    // Paragraphe normal
    nodes.push(
      <p
        key={i}
        style={{ fontSize: 13, color: TEXT, lineHeight: 1.6, margin: "2px 0" }}
      >
        <InlineText text={line} />
      </p>,
    );
    i++;
  }

  return nodes;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function MessageBubble({ children }: { children: React.ReactNode }) {
  if (typeof children === "string") {
    return <div>{parseMarkdown(children)}</div>;
  }
  return <div>{children}</div>;
}
