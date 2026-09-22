import { getAuthClient } from "@/lib/auth/client";
import type { AnalyticsSnapshot, BackofficeRole, BackofficeSnapshot, JsonObject, RestrictionKind } from "./types";

export type BackofficeData = BackofficeSnapshot & {
  submissions: Array<Record<string, unknown>>;
  people: Array<Record<string, unknown>>;
};

export type BackofficeCommand =
  | { command: "read"; input?: Record<string, unknown> }
  | { command: "review_report"; input: { report_id: string; status: "in_review" | "resolved" | "dismissed" | "escalated"; note?: string; priority?: "low" | "normal" | "high" | "urgent"; assigned_to?: string | null } }
  | { command: "restrict_user"; input: { user_id: string; kind: RestrictionKind; reason: string; ends_at?: string | null } }
  | { command: "revoke_restriction"; input: { restriction_id: string; reason?: string } }
  | { command: "review_submission"; input: { id: string; status: "accepted" | "rejected" | "changes_requested"; note?: string } }
  | { command: "set_feature_flag"; input: { key: string; enabled: boolean; config?: JsonObject } };

function assertPayload(payload: unknown): BackofficeData {
  if (!payload || typeof payload !== "object") throw new Error("BACKOFFICE_INVALID_RESPONSE");
  const value = payload as Partial<BackofficeData>;
  if (!["admin", "moderator", "editor", "support"].includes(String(value.role))) throw new Error("BACKOFFICE_ACCESS_REQUIRED");
  return {
    role: value.role as BackofficeRole,
    metrics: value.metrics ?? { pending_reports: 0, urgent_reports: 0, pending_account_requests: 0, pending_magazine_submissions: 0, active_restrictions: 0, active_members: 0, projects_with_open_roles: 0, upcoming_plans: 0 },
    reports: Array.isArray(value.reports) ? value.reports : [],
    account_requests: Array.isArray(value.account_requests) ? value.account_requests : [],
    restrictions: Array.isArray(value.restrictions) ? value.restrictions : [],
    audit: Array.isArray(value.audit) ? value.audit : [],
    feature_flags: Array.isArray(value.feature_flags) ? value.feature_flags : [],
    submissions: Array.isArray(value.submissions) ? value.submissions : [],
    people: Array.isArray(value.people) ? value.people : [],
  };
}

/**
 * Reads the private operations snapshot through the authenticated RPC.
 * The database decides the operator role; no client supplied role is trusted.
 */
export async function readBackoffice(): Promise<BackofficeData> {
  const result = await getAuthClient().rpc("universe_backoffice", { p_command: "read", p_input: {} });
  if (result.error) throw result.error;
  return assertPayload(result.data);
}

/** Executes one audited backoffice mutation and returns the fresh snapshot. */
export async function runBackofficeCommand(request: BackofficeCommand): Promise<BackofficeData> {
  const result = await getAuthClient().rpc("universe_backoffice", { p_command: request.command, p_input: request.input ?? {} });
  if (result.error) throw result.error;
  return assertPayload(result.data);
}


export async function readAnalytics(days = 30): Promise<AnalyticsSnapshot> {
  const result = await getAuthClient().rpc("universe_analytics_snapshot", { p_days: days });
  if (result.error) throw result.error;
  const value = (result.data ?? {}) as Partial<AnalyticsSnapshot>;
  return {
    period_days: Number(value.period_days ?? days),
    sessions: Number(value.sessions ?? 0),
    members: Number(value.members ?? 0),
    active_now: Number(value.active_now ?? 0),
    avg_active_seconds: Number(value.avg_active_seconds ?? 0),
    top_pages: Array.isArray(value.top_pages) ? value.top_pages.map(item => ({ path: String(item.path ?? "/app"), sessions: Number(item.sessions ?? 0) })) : [],
    top_events: Array.isArray(value.top_events) ? value.top_events.map(item => ({ event_name: String(item.event_name ?? ""), events: Number(item.events ?? 0) })) : [],
    daily: Array.isArray(value.daily) ? value.daily.map(item => ({ day: String(item.day ?? ""), sessions: Number(item.sessions ?? 0), members: Number(item.members ?? 0), active_seconds: Number(item.active_seconds ?? 0) })) : [],
  };
}
