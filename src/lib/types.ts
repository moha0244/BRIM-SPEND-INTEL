// src/lib/types.ts
// Toutes les interfaces du domaine Brim Finance AI

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface Transaction {
  id: number;
  transaction_code: number;
  card_label: string;
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  mcc: number;
  mcc_label: string;
  mcc_category: string;
  city: string;
  compliance_status: string;
  approval_status: string | null;
  violation: ViolationSummary | null;
  report: ReportSummary | null;
}

export interface TransactionRaw {
  id: number;
  transaction_code: number;
  merchant_name: string;
  transaction_date: string;
  amount_cad: number;
  currency?: string;
  merchant_city?: string | null;
  merchant_state_province?: string | null;
  merchant_country?: string | null;
  mcc?: number;
  mcc_label?: string;
  mcc_category?: string;
}

// ─── Conformité ───────────────────────────────────────────────────────────────

export type Severity = "critical" | "high" | "medium" | "low";
export type ViolationStatus = "open" | "resolved" | "dismissed";

export interface Violation {
  id: number;
  severity: Severity;
  ai_explanation: string;
  status: ViolationStatus;
  detected_at: string;
  transaction: TransactionRaw;
  rule: PolicyRuleSummary;
}

export interface ViolationSummary {
  severity: string;
  ai_explanation: string;
  status: string;
}

export interface ComplianceStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  resolved: number;
}

// ─── Politique ────────────────────────────────────────────────────────────────

export interface PolicyRule {
  id: number;
  rule_code: string;
  category: string;
  description_fr: string;
  rule_type: string;
  condition_json: Record<string, unknown>;
  threshold_amount: number | null;
  action: string;
  severity: Severity;
  evidence_text: string;
  is_active: boolean;
}

export interface PolicyRuleSummary {
  rule_code: string;
  category: string;
  description_fr: string;
  action: string;
}

// ─── Approbations ─────────────────────────────────────────────────────────────

export type ApprovalDecision = "approved" | "rejected" | "pending" | null;
export type AIRecommendation = "Approuver" | "Refuser" | "Prudence";

export interface ApprovalRequest {
  id: number;
  ai_recommendation: AIRecommendation | null;
  ai_reasoning: string | null;
  decision: ApprovalDecision;
  created_at: string;
  transaction: TransactionRaw;
}

export interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
}

// ─── Rapports ─────────────────────────────────────────────────────────────────

export type ReportStatus = "draft" | "pending_cfo" | "approved" | "rejected";

export interface Report {
  id: number;
  report_name: string;
  transaction_code: number;
  date_start: string;
  date_end: string;
  total_amount_cad: number;
  transaction_count?: number;
  status: ReportStatus;
  ai_summary?: string;
  cfo_recommendation?: string;
  created_at: string;
}

export interface ReportSummary {
  report_id: number;
  report_name: string;
  report_status: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChartData {
  chart_type: "bar" | "line" | "pie" | "table" | "number" | "none";
  chart_title: string;
  x_axis?: string;
  y_axis?: string;
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

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardAlerts {
  criticalViolations: number;
  pendingApprovals: number;
  pendingReports: number;
}

export interface DashboardKPIs {
  totalSpend: number;
  totalTransactions: number;
  avgTransaction: number;
  complianceRate: number;
}

export interface DashboardData {
  alerts: DashboardAlerts;
  kpis: DashboardKPIs;
  monthly: { month: string; total: number }[];
  mccCategories: { category: string; total: number; nb: number }[];
  recentTransactions: {
    id: number;
    transaction_code: number;
    card_label: string;
    date: string;
    merchant: string;
    amount: number;
    mcc_label: string;
    compliance_status: string;
  }[];
}
