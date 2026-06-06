// src/components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  ShieldCheck,
  Clock,
  FileText,
  MessageCircle,
} from "lucide-react";

interface Badges {
  compliance: number;
  approvals: number;
}

const NAV_MAIN = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  {
    href: "/compliance",
    label: "Conformité",
    icon: ShieldCheck,
    badge: "compliance",
  },
  {
    href: "/approvals",
    label: "Approbations",
    icon: Clock,
    badge: "approvals",
  },
  { href: "/reports", label: "Rapports", icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Badges>({ compliance: 0, approvals: 0 });

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        if (data.alerts) {
          setBadges({
            compliance:
              (data.alerts.criticalViolations ?? 0) +
              (data.alerts.pendingApprovals ?? 0),
            approvals: data.alerts.pendingApprovals ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      style={{
        width: 220,
        background: "#0B1120",
        borderRight: "1px solid #1a2236",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        height: "100%",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid #1a2236",
        }}
      >
        <p
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "#E8EDF5",
            lineHeight: 1,
          }}
        >
          <span style={{ color: "#00F5A0" }}>BRIM</span>{" "}
          <span style={{ color: "#E8EDF5" }}>SPEND INTEL</span>{" "}
        </p>
      </div>

      {/* Nav principal */}
      <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
        {NAV_MAIN.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(href);
          const badgeCount =
            badge === "compliance"
              ? badges.compliance
              : badge === "approvals"
                ? badges.approvals
                : 0;

          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 20px",
                fontSize: 13,
                color: active ? "#E8EDF5" : "#4A5A7A",
                background: active ? "#0F1A2E" : "transparent",
                borderLeft: `2px solid ${active ? "#00F5A0" : "transparent"}`,
                textDecoration: "none",
                transition: "all 0.12s",
              }}
            >
              <Icon
                size={16}
                style={{ color: active ? "#00F5A0" : "inherit", flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>{label}</span>
              {badgeCount > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: 99,
                    background: badge === "compliance" ? "#200a10" : "#1a1200",
                    color: badge === "compliance" ? "#ff4d6d" : "#f5a623",
                    border: `1px solid ${badge === "compliance" ? "#3a1520" : "#3a2800"}`,
                    minWidth: 18,
                    textAlign: "center",
                  }}
                >
                  {badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Chat IA — séparé en bas */}
      <div style={{ borderTop: "1px solid #1a2236" }}>
        <Link
          href="/chat"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 20px",
            fontSize: 13,
            color: pathname.startsWith("/chat") ? "#00F5A0" : "#4A5A7A",
            background: pathname.startsWith("/chat")
              ? "#0F1A2E"
              : "transparent",
            textDecoration: "none",
            transition: "all 0.12s",
          }}
        >
          <MessageCircle size={16} style={{ flexShrink: 0 }} />
          <span>Chat</span>
        </Link>
        <div
          style={{
            padding: "8px 20px 14px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            color: "#2A3A55",
            lineHeight: 1.8,
          }}
        >
          <span style={{ color: "#00c97e" }}>●</span> Connecté · v2.1.0
          <br />4 235 txns · 7 mois
        </div>
      </div>
    </aside>
  );
}
