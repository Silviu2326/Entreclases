import type { BackofficeSnapshot, ModerationReport } from "./types";
import { emptyBackofficeSnapshot } from "./types";

/**
 * Disposable records for the demo backoffice. They are intentionally kept in
 * their own module so the production panel can swap to the Supabase RPC
 * without importing fake moderation data.
 */
export function createBackofficeDemo(userId = "demo-alex"): BackofficeSnapshot {
  const now = Date.now();
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  const report = (item: Omit<ModerationReport, "created_at" | "updated_at" | "resolved_at">, minutesAgo: number): ModerationReport => ({
    ...item,
    created_at: at(minutesAgo),
    updated_at: at(minutesAgo),
    resolved_at: null,
  });

  const state = emptyBackofficeSnapshot("admin");
  state.metrics = {
    pending_reports: 4,
    urgent_reports: 1,
    pending_account_requests: 3,
    pending_magazine_submissions: 9,
    active_restrictions: 2,
    active_members: 1240,
    projects_with_open_roles: 7,
    upcoming_plans: 14,
  };
  state.reports = [
    report({ id: "demo-report-104", reporter_id: "demo-paula", target_type: "post", target_id: "demo-post-01", reason_code: "harassment", detail: "Denuncia por posible acoso en un hilo de Benimaclet.", content_excerpt: "Ese comentario no tiene sitio aquí.", metadata: { campus: "Tarongers" }, status: "pending", priority: "urgent", assigned_to: null, resolution: "" }, 18),
    report({ id: "demo-report-103", reporter_id: "demo-nico", target_type: "game", target_id: "demo-game-01", reason_code: "privacy", detail: "Una partida puede revelar información que la persona no quería publicar.", content_excerpt: "La ronda incluye un dato personal.", metadata: { game: "preguntas" }, status: "in_review", priority: "high", assigned_to: userId, resolution: "" }, 42),
    report({ id: "demo-report-102", reporter_id: "demo-laia", target_type: "project", target_id: "project-fashion", reason_code: "misleading", detail: "El proyecto no aclara todavía qué ofrece a sus colaboradores.", content_excerpt: "Buscamos programadores para hacerlo realidad.", metadata: { section: "Proyectos" }, status: "pending", priority: "normal", assigned_to: null, resolution: "" }, 60),
    report({ id: "demo-report-101", reporter_id: "demo-marc", target_type: "profile", target_id: "demo-marc", reason_code: "access", detail: "No puede confirmar el correo universitario.", content_excerpt: "No me llega el correo de confirmación.", metadata: { university: "Universitat de València" }, status: "pending", priority: "normal", assigned_to: null, resolution: "" }, 120),
  ];
  state.account_requests = [
    { id: "demo-request-01", user_id: "demo-marc", kind: "access", detail: "No puede confirmar el correo universitario.", status: "pending", assigned_to: null, resolution: "", created_at: at(120), updated_at: at(120), resolved_at: null },
    { id: "demo-request-02", user_id: "demo-aina", kind: "privacy", detail: "Quiere retirar una imagen antigua de una propuesta.", status: "in_review", assigned_to: userId, resolution: "", created_at: at(160), updated_at: at(40), resolved_at: null },
    { id: "demo-request-03", user_id: "demo-laia", kind: "deletion", detail: "Solicitud de eliminación de cuenta pendiente de revisar.", status: "pending", assigned_to: null, resolution: "", created_at: at(300), updated_at: at(300), resolved_at: null },
  ];
  state.restrictions = [
    { id: "demo-restriction-01", user_id: "demo-visitor", kind: "warning", reason: "Publicación repetida fuera de la temática del grupo.", starts_at: at(720), ends_at: null, created_by: userId, revoked_at: null, revoked_by: null, created_at: at(720) },
    { id: "demo-restriction-02", user_id: "demo-someone", kind: "suspension", reason: "Acoso confirmado tras revisión de una denuncia.", starts_at: at(1200), ends_at: new Date(now + 48 * 60 * 60_000).toISOString(), created_by: userId, revoked_at: null, revoked_by: null, created_at: at(1200) },
  ];
  state.feature_flags = [
    { key: "explore_projects", enabled: true, config: { highlighted_limit: 6 }, updated_by: userId, updated_at: at(30) },
    { key: "game_questions", enabled: true, config: { anonymous: true }, updated_by: userId, updated_at: at(30) },
    { key: "magazine_submissions", enabled: true, config: { max_images: 4 }, updated_by: userId, updated_at: at(30) },
  ];
  return state;
}

