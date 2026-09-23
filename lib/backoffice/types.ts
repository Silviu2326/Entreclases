/**
 * Shared contracts for the private Entreclases backoffice.
 *
 * These types deliberately keep the moderation and editorial queues separate
 * from the public community models. A backoffice record can include an
 * internal note or a moderation snapshot, so it must never be passed to the
 * public client accidentally.
 */

export const backofficeRoles = ["admin", "moderator", "editor", "support"] as const;
export type BackofficeRole = (typeof backofficeRoles)[number];

export const moderationTargetTypes = ["profile", "post", "comment", "group", "plan", "project", "game", "message"] as const;
export type ModerationTargetType = (typeof moderationTargetTypes)[number];

export const moderationStatuses = ["pending", "in_review", "resolved", "dismissed", "escalated"] as const;
export type ModerationStatus = (typeof moderationStatuses)[number];

export const moderationPriorities = ["low", "normal", "high", "urgent"] as const;
export type ModerationPriority = (typeof moderationPriorities)[number];

export const moderationActionKinds = ["note", "hide_content", "restore_content", "warn", "restrict", "escalate", "resolve", "dismiss"] as const;
export type ModerationActionKind = (typeof moderationActionKinds)[number];

export const restrictionKinds = ["warning", "suspension", "ban"] as const;
export type RestrictionKind = (typeof restrictionKinds)[number];

export const accountRequestKinds = ["deletion", "access", "verification", "privacy"] as const;
export type AccountRequestKind = (typeof accountRequestKinds)[number];

export const accountRequestStatuses = ["pending", "in_review", "completed", "rejected"] as const;
export type AccountRequestStatus = (typeof accountRequestStatuses)[number];

export type JsonObject = Record<string, unknown>;

export type BackofficeRoleAssignment = {
  user_id: string;
  role: BackofficeRole;
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
};

export type ModerationReport = {
  id: string;
  reporter_id: string | null;
  target_type: ModerationTargetType;
  target_id: string;
  reason_code: string;
  detail: string;
  /** Server-created context. It may contain a message excerpt, never secrets. */
  content_excerpt: string;
  metadata: JsonObject;
  status: ModerationStatus;
  priority: ModerationPriority;
  assigned_to: string | null;
  resolution: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type ModerationAction = {
  id: string;
  report_id: string;
  actor_id: string;
  kind: ModerationActionKind;
  note: string;
  metadata: JsonObject;
  created_at: string;
};

export type UserRestriction = {
  id: string;
  user_id: string;
  kind: RestrictionKind;
  reason: string;
  starts_at: string;
  ends_at: string | null;
  created_by: string;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
};

export type AccountRequest = {
  id: string;
  user_id: string;
  kind: AccountRequestKind;
  detail: string;
  status: AccountRequestStatus;
  assigned_to: string | null;
  resolution: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type BackofficeAuditEvent = {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  detail: JsonObject;
  created_at: string;
};

export type BackofficeFeatureFlag = {
  key: string;
  enabled: boolean;
  config: JsonObject;
  updated_by: string | null;
  updated_at: string;
};

export type BackofficeMetrics = {
  pending_reports: number;
  urgent_reports: number;
  pending_account_requests: number;
  pending_magazine_submissions: number;
  active_restrictions: number;
  active_members: number;
  projects_with_open_roles: number;
  upcoming_plans: number;
};

export type WaitlistSnapshot = {
  total: number;
  active: number;
  new_today: number;
  new_last_7_days: number;
  last_signup_at: string | null;
  sources: Array<{ source: string; total: number }>;
};

export type AnalyticsSnapshot = {
  period_days: number;
  sessions: number;
  members: number;
  active_now: number;
  avg_active_seconds: number;
  top_pages: Array<{ path: string; sessions: number }>;
  top_events: Array<{ event_name: string; events: number }>;
  daily: Array<{ day: string; sessions: number; members: number; active_seconds: number }>;
};
export type BackofficeSnapshot = {
  role: BackofficeRole;
  metrics: BackofficeMetrics;
  reports: ModerationReport[];
  account_requests: AccountRequest[];
  restrictions: UserRestriction[];
  audit: BackofficeAuditEvent[];
  feature_flags: BackofficeFeatureFlag[];
};

export type ReviewReportInput = {
  report_id: string;
  status: Exclude<ModerationStatus, "pending">;
  note: string;
  priority?: ModerationPriority;
  assigned_to?: string | null;
};

export type RestrictUserInput = {
  user_id: string;
  kind: RestrictionKind;
  reason: string;
  ends_at?: string | null;
};

export type BackofficeRepository = {
  read(): Promise<BackofficeSnapshot>;
  reviewReport(input: ReviewReportInput): Promise<void>;
  restrictUser(input: RestrictUserInput): Promise<void>;
  revokeRestriction(restrictionId: string, reason: string): Promise<void>;
  setFeatureFlag(key: string, enabled: boolean, config?: JsonObject): Promise<void>;
};

export const emptyBackofficeSnapshot = (role: BackofficeRole = "support"): BackofficeSnapshot => ({
  role,
  metrics: {
    pending_reports: 0,
    urgent_reports: 0,
    pending_account_requests: 0,
    pending_magazine_submissions: 0,
    active_restrictions: 0,
    active_members: 0,
    projects_with_open_roles: 0,
    upcoming_plans: 0,
  },
  reports: [],
  account_requests: [],
  restrictions: [],
  audit: [],
  feature_flags: [],
});