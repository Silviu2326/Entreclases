"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, BarChart3, Check, ChevronRight, CircleDollarSign,
  ClipboardList, FileText, Flag, LayoutDashboard, Newspaper, Pause, Play,
  Search, Settings2, ShieldCheck, Sparkles, Users, UserPlus, Bell, X,
} from "lucide-react";
import { createBackofficeDemo } from "@/lib/backoffice/demo";
import { readAnalytics, readBackoffice, readWaitlistSnapshot, runBackofficeCommand, type BackofficeCommand, type BackofficeData } from "@/lib/backoffice/client";
import { loadBackofficeSession, persistBackofficeAction, type BackofficeAction } from "@/lib/backoffice/repository";
import type { AnalyticsSnapshot, WaitlistSnapshot } from "@/lib/backoffice/types";
import { WarmupsPanel } from "./warmups-panel";
import "./backoffice.css";

type Section = "overview" | "analytics" | "waitlist" | "moderation" | "editorial" | "warmups" | "people" | "coins" | "settings";
type CaseItem = { id: string | number; type: string; title: string; detail: string; time: string; priority: "Alta" | "Media" | "Baja"; state: "Pendiente" | "En revisión" | "Resuelto" };
type Proposal = { id: string | number; title: string; author: string; section: string; state: "En revisión" | "Aceptada" | "Rechazada"; age: string };

const casesSeed: CaseItem[] = [
  { id: 1, type: "Pregunta anónima", title: "Revisa una pregunta denunciada", detail: "3 denuncias · Sin dar la cara", time: "hace 12 min", priority: "Alta", state: "Pendiente" },
  { id: 2, type: "Perfil", title: "Solicitud de revisión de una suspensión", detail: "Laia Soler · Blasco Ibáñez", time: "hace 48 min", priority: "Media", state: "En revisión" },
  { id: 3, type: "Proyecto", title: "Proyecto sin aportación descrita", detail: "Tu próxima colección, sin probador", time: "hace 2 h", priority: "Baja", state: "Pendiente" },
  { id: 4, type: "Plan", title: "Un plan ha sido cancelado", detail: "La última luz en la Malvarrosa", time: "ayer", priority: "Media", state: "Pendiente" },
];

const proposalsSeed: Proposal[] = [
  { id: 1, title: "Lo que aprendí haciendo un corto entre clases", author: "Laia Soler", section: "Proyectos", state: "En revisión", age: "hace 19 min" },
  { id: 2, title: "La biblioteca también tiene sus historias", author: "Marc Ferrer", section: "Vida de campus", state: "Aceptada", age: "ayer" },
  { id: 3, title: "Una guía para llegar a Vera sin perderse", author: "Nico Vidal", section: "Campus", state: "En revisión", age: "ayer" },
];

const nav: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Inicio", icon: LayoutDashboard },
  { id: "analytics", label: "Analítica", icon: BarChart3 },
  { id: "waitlist", label: "Altas", icon: UserPlus },
  { id: "moderation", label: "Moderación", icon: ShieldCheck },
  { id: "editorial", label: "Entre líneas", icon: Newspaper },
  { id: "warmups", label: "Calentamientos", icon: Sparkles },
  { id: "people", label: "Personas", icon: Users },
  { id: "coins", label: "ClasiCoins", icon: CircleDollarSign },
  { id: "settings", label: "Configuración", icon: Settings2 },
];

function relativeTime(value: unknown) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "ahora";
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  return minutes < 60 ? `hace ${minutes} min` : minutes < 1440 ? `hace ${Math.round(minutes / 60)} h` : `hace ${Math.round(minutes / 1440)} d`;
}

function serverCases(data: BackofficeData): CaseItem[] {
  return data.reports.map(report => ({
    id: report.id,
    type: report.target_type,
    title: `${report.reason_code.replaceAll("_", " ")} · ${report.target_type}`,
    detail: report.detail || report.content_excerpt,
    time: relativeTime(report.created_at),
    priority: report.priority === "urgent" || report.priority === "high" ? "Alta" : report.priority === "normal" ? "Media" : "Baja",
    state: report.status === "resolved" || report.status === "dismissed" ? "Resuelto" : report.status === "in_review" ? "En revisión" : "Pendiente",
  }));
}

function serverProposals(data: BackofficeData): Proposal[] {
  return data.submissions.map(item => {
    const status = String(item.status ?? "pending");
    return {
      id: String(item.id ?? crypto.randomUUID()),
      title: String(item.title ?? "Propuesta sin título"),
      author: String(item.attribution ?? item.author_name ?? "Autoría pendiente"),
      section: String(item.kind ?? "Comunidad"),
      state: status === "accepted" || status === "published" ? "Aceptada" : status === "rejected" ? "Rechazada" : "En revisión",
      age: relativeTime(item.created_at),
    };
  });
}

function restoreDemoCases() {
  const saved = loadBackofficeSession().cases ?? [];
  return casesSeed.map(item => {
    const match = saved.find(savedItem => String(savedItem.id) === String(item.id));
    return match ? { ...item, state: match.state as CaseItem["state"] } : item;
  });
}

function restoreDemoProposals() {
  const saved = loadBackofficeSession().proposals ?? [];
  return proposalsSeed.map(item => {
    const match = saved.find(savedItem => String(savedItem.id) === String(item.id));
    return match ? { ...item, state: match.state as Proposal["state"] } : item;
  });
}

const gamesSeed = [
  { name: "¿Me lío?", active: true, activity: "18 partidas esta semana" },
  { name: "Sin dar la cara", active: true, activity: "42 preguntas recibidas" },
  { name: "Defiende lo indefendible", active: true, activity: "27 duelos abiertos" },
  { name: "Dos verdades y una trola", active: false, activity: "Pausado por ahora" },
  { name: "Hay hueco", active: true, activity: "9 planes creados" },
  { name: "El jurado del campus", active: true, activity: "13 veredictos" },
  { name: "La cita empieza hablando", active: true, activity: "6 conversaciones" },
];

function restoreDemoGames() {
  const saved = loadBackofficeSession().games ?? [];
  return gamesSeed.map(item => {
    const match = saved.find(savedItem => savedItem.name === item.name);
    return match ? { ...item, ...match } : item;
  });
}

export function BackofficeApp({ locale = "es" }: { locale?: "es" | "va" }) {
  const demoSnapshot = useMemo(() => createBackofficeDemo(), []);
  const [section, setSection] = useState<Section>(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "waitlist") return "waitlist";
    return "overview";
  });
  const [cases, setCases] = useState(restoreDemoCases);
  const [proposals, setProposals] = useState(restoreDemoProposals);
  const demoMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
  const [accessError, setAccessError] = useState<string | null>(null);
  const [serverData, setServerData] = useState<BackofficeData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSnapshot | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistSnapshot | null>(null);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [games, setGames] = useState(restoreDemoGames);
  const text = locale === "va" ? { demo: "Vista de demostració", title: "El que necessita atenció.", sub: "Gestiona Entreclases amb context i sense perdre el fil.", search: "Buscar en el backoffice…" } : { demo: "Vista de demostración", title: "Lo que necesita atención.", sub: "Gestiona Entreclases con contexto y sin perder el hilo.", search: "Buscar en el backoffice…" };
  const pending = cases.filter(item => item.state !== "Resuelto").length;
  const filteredCases = useMemo(() => cases.filter(item => `${item.title} ${item.detail} ${item.type}`.toLowerCase().includes(query.toLowerCase())), [cases, query]);
  const filteredProposals = useMemo(() => proposals.filter(item => `${item.title} ${item.author} ${item.section}`.toLowerCase().includes(query.toLowerCase())), [proposals, query]);

  useEffect(() => {
    const isDemo = new URLSearchParams(window.location.search).get("demo") === "1";
    if (isDemo) {
      queueMicrotask(() => setHydrated(true));
      return;
    }
    void readAnalytics().then(setAnalytics).catch(() => undefined);
    void readWaitlistSnapshot().then(setWaitlist).catch(error => setWaitlistError(String(error?.message ?? error?.code ?? "No se pudo cargar la lista.")));
    void readBackoffice().then(data => {
      setServerData(data);
      const nextCases = serverCases(data);
      const nextProposals = serverProposals(data);
      if (nextCases.length) setCases(nextCases);
      if (nextProposals.length) setProposals(nextProposals);
      setHydrated(true);
    }).catch(error => {
      const message = String(error?.code ?? error?.message ?? "");
      setAccessError(/ACCESS_REQUIRED|permission|not configured|auth|session|jwt|PGRST301/i.test(message) ? "Necesitas iniciar sesión con una cuenta de administración para entrar aquí." : "No hemos podido cargar el backoffice. Revisa la conexión e inténtalo de nuevo.");
      setHydrated(true);
    });
  }, []);

  async function runAction(key: string, action: BackofficeAction, serverAction: BackofficeCommand, apply: () => void, success: string) {
    if (busyAction) return;
    setBusyAction(key); setFeedback(null);
    try {
      if (demoMode) await persistBackofficeAction(action);
      else {
        const fresh = await runBackofficeCommand(serverAction);
        setServerData(fresh);
      }
      apply(); setFeedback({ kind: "ok", text: success });
    }
    catch (error) { setFeedback({ kind: "error", text: error instanceof Error ? error.message : "No se ha podido guardar. Inténtalo de nuevo." }); }
    finally { setBusyAction(null); }
  }

  function resolveCase(id: string | number) {
    if (typeof window !== "undefined" && !window.confirm("¿Marcar este caso como resuelto? La decisión quedará registrada.")) return;
    void runAction(`case-${id}`, { command: "resolve_case", id, state: "Resuelto" }, { command: "review_report", input: { report_id: String(id), status: "resolved", note: "Resuelto desde el backoffice." } }, () => setCases(current => current.map(item => item.id === id ? { ...item, state: "Resuelto" } : item)), "Caso resuelto.");
  }
  function setProposalState(id: string | number, state: Exclude<Proposal["state"], "En revisión">) {
    if (state === "Rechazada" && typeof window !== "undefined" && !window.confirm("¿Rechazar esta propuesta editorial?")) return;
    
    void runAction(`proposal-${id}`, { command: "proposal_state", id, state }, { command: "review_submission", input: { id: String(id), status: state === "Aceptada" ? "accepted" : "rejected", note: state === "Aceptada" ? "Aceptada desde el backoffice." : "Rechazada desde el backoffice." } }, () => setProposals(current => current.map(item => item.id === id ? { ...item, state } : item)), state === "Aceptada" ? "Propuesta aceptada." : "Propuesta rechazada.");
  }
  function toggleGame(name: string) {
    const current = games.find(game => game.name === name);
    if (!current) return;
    const next = !current.active;
    if (!next && typeof window !== "undefined" && !window.confirm("¿Pausar este juego? Dejará de aparecer para la comunidad.")) return;
    void runAction(`game-${name}`, { command: "game_state", name, active: next }, { command: "set_feature_flag", input: { key: `game_${name.toLowerCase().replaceAll(" ", "_")}`, enabled: next, config: {} } }, () => setGames(items => items.map(game => game.name === name ? { ...game, active: next, activity: next ? "Activo · esperando participación" : "Pausado por ahora" } : game)), next ? "Juego activado." : "Juego pausado.");
  }

  if (accessError && !demoMode) return <AccessGate message={accessError} onRetry={() => window.location.reload()} />;

  return <div className="bo-app">
    <aside className="bo-sidebar">
      <a className="bo-brand" href="/demo/?view=explore"><span className="bo-brand-mark">E</span><span>entreclases</span></a>
      <div className="bo-workspace"><span className="bo-workspace-dot" />Equipo Entreclases <small>València</small></div>
      <nav className="bo-nav" aria-label="Navegación del backoffice">{nav.map(item => { const Icon = item.icon; return <button key={item.id} className={section === item.id ? "is-active" : ""} onClick={() => setSection(item.id)}><Icon aria-hidden="true" />{item.label}{item.id === "moderation" && pending > 0 && <b>{pending}</b>}</button>; })}</nav>
      <div className="bo-sidebar-foot"><div className="bo-user"><span>AT</span><div><strong>Álex Torres</strong><small>Administrador</small></div></div><a href="/demo/?view=explore">Volver a la aplicación <ArrowUpRight size={15} /></a></div>
    </aside>
    <main className="bo-main">
      <header className="bo-topbar"><div><p className="bo-breadcrumb">ENTRECLASE <ChevronRight size={14} /> BACKOFFICE</p><h1>{section === "overview" ? text.title : nav.find(item => item.id === section)?.label}</h1><p className="bo-subtitle">{section === "overview" ? text.sub : section === "moderation" ? "Casos, denuncias y decisiones de convivencia." : section === "editorial" ? "Propuestas y ediciones de Entre líneas." : section === "warmups" ? "Lo que propone la IA, antes de que lo vea nadie." : section === "waitlist" ? "El crecimiento de la comunidad, con acceso solo para ti." : "Una vista operativa de la comunidad."}</p></div><div className="bo-top-actions"><span className="bo-demo-pill"><Sparkles size={15} />{demoMode ? text.demo : "Sesión operativa"}</span><button className="bo-avatar" aria-label="Cuenta de administrador">AT</button></div></header>
      {demoMode && <div className="bo-demo-banner"><AlertTriangle size={16} /><span><strong>Datos de demostración.</strong> Las acciones cambian esta visita y no afectan a usuarios reales.</span></div>}
      <div className="bo-content">
        <label className="bo-search"><Search size={18} /><span className="sr-only">{text.search}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={text.search} /></label>
        {!hydrated && <div className="bo-feedback bo-feedback-loading" role="status"><span className="bo-spinner" />Cargando el estado guardado…</div>}
        {feedback && <div className={`bo-feedback bo-feedback-${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.text}<button onClick={() => setFeedback(null)} aria-label="Cerrar aviso"><X size={14} /></button></div>}
        {section === "overview" && <Overview pending={pending} cases={cases} proposals={proposals} games={games} snapshot={serverData ?? demoSnapshot} onNavigate={setSection} />}
        {section === "analytics" && <AnalyticsPanel data={analytics} />}
        {section === "waitlist" && <WaitlistPanel data={waitlist} error={waitlistError} demoMode={demoMode} />}
        {section === "moderation" && <Moderation items={filteredCases} onResolve={resolveCase} busyAction={busyAction} />}
        {section === "editorial" && <Editorial items={filteredProposals} onState={setProposalState} busyAction={busyAction} />}
        {section === "warmups" && <WarmupsPanel demoMode={demoMode} />}
        {section === "people" && <People query={query} people={serverData?.people} />}
        {section === "coins" && <Coins />}
        {section === "settings" && <Settings games={games} onToggle={toggleGame} busyAction={busyAction} />}
      </div>
    </main>
  </div>;
}

function Overview({ pending, cases, proposals, games, snapshot, onNavigate }: { pending: number; cases: CaseItem[]; proposals: Proposal[]; games: { name: string; active: boolean; activity: string }[]; snapshot: ReturnType<typeof createBackofficeDemo>; onNavigate: (section: Section) => void }) {
  return <>
    <section className="bo-hero"><div><span className="bo-eyebrow">LUNES · 09:42</span><h2>La comunidad está viva.<br /><em>Ahora toca cuidarla.</em></h2><p>4 asuntos requieren una decisión, 2 propuestas esperan una respuesta y 6 juegos están generando conversación.</p></div><div className="bo-hero-orbit"><span>18</span><small>acciones<br />esta semana</small></div></section>
    <section className="bo-metrics"><Metric label="Pendientes" value={pending} detail="requieren atención" tone="lime" icon={ClipboardList} /><Metric label="Denuncias" value={snapshot.metrics.pending_reports + 2} detail={`${snapshot.metrics.urgent_reports} de prioridad alta`} tone="coral" icon={Flag} /><Metric label="Propuestas" value={snapshot.metrics.pending_magazine_submissions} detail="en Entre líneas" tone="lavender" icon={FileText} /><Metric label="Participación" value={`${Math.round((snapshot.metrics.active_members / 1700) * 100)}%`} detail={`${snapshot.metrics.active_members} cuentas activas`} tone="blue" icon={BarChart3} /></section>
    <div className="bo-columns"><section className="bo-panel"><PanelHeading eyebrow="PARA HOY" title="Lo que necesita una respuesta" action="Ver moderación" onClick={() => onNavigate("moderation")} />{cases.slice(0, 3).map(item => <CaseRow key={item.id} item={item} compact />)}</section><section className="bo-panel"><PanelHeading eyebrow="ENTRE LÍNEAS" title="La redacción está esperando" action="Abrir propuestas" onClick={() => onNavigate("editorial")} />{proposals.map(item => <ProposalRow key={item.id} item={item} compact />)}</section></div>
    <section className="bo-panel bo-games-panel"><PanelHeading eyebrow="EXPLORAR · JUEGOS" title="El campus también juega" action="Configurar" onClick={() => onNavigate("settings")} /><div className="bo-game-list">{games.map(game => <div className="bo-game-row" key={game.name}><span className={`bo-game-status ${game.active ? "on" : ""}`} /><strong>{game.name}</strong><small>{game.activity}</small><button onClick={() => onNavigate("settings")}><ChevronRight size={16} /></button></div>)}</div></section>
  </>;
}

function WaitlistPanel({ data, error, demoMode }: { data: WaitlistSnapshot | null; error: string | null; demoMode: boolean }) {
  const [notifyEnabled, setNotifyEnabled] = useState(() => typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" && localStorage.getItem("entreclases-waitlist-notifications") === "on");
  const [notifyMessage, setNotifyMessage] = useState("");
  const knownTotal = useRef<number | null>(data?.total ?? null);
  useEffect(() => {
    if (data) knownTotal.current = data.total;
  }, [data]);
  useEffect(() => {
    if (demoMode || !notifyEnabled) return;
    const timer = window.setInterval(() => {
      void readWaitlistSnapshot().then(next => {
        if (knownTotal.current !== null && next.total > knownTotal.current && "Notification" in window && Notification.permission === "granted") {
          new Notification("Nueva alta en Entreclases", { body: "Hay una persona nueva en la lista de espera." });
        }
        knownTotal.current = next.total;
      }).catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [demoMode, notifyEnabled]);
  const shown = data ?? (demoMode ? { total: 184, active: 178, new_today: 12, new_last_7_days: 47, last_signup_at: "2026-09-22T10:30:00.000Z", sources: [{ source: "landing", total: 142 }, { source: "roadmap", total: 42 }] } : null);
  async function enableNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) { setNotifyMessage("Este navegador no admite avisos de escritorio."); return; }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") { setNotifyMessage("Los avisos están bloqueados. Puedes activarlos desde los ajustes del navegador."); return; }
    localStorage.setItem("entreclases-waitlist-notifications", "on"); setNotifyEnabled(true);
    setNotifyMessage("Avisos activados en este dispositivo.");
    new Notification("Entreclases · avisos privados", { body: "Te avisaremos cuando se detecte una nueva alta mientras el panel esté abierto." });
  }
  if (!shown) return <section className="bo-detail"><div className={"bo-feedback bo-feedback-" + (error ? "error" : "loading")} role={error ? "alert" : "status"}>{error ? "No se han podido cargar las altas. Aplica la migración 202609260026_waitlist_snapshot en Supabase." : <><span className="bo-spinner" />Cargando las altas…</>}</div></section>;
  const lastSignup = shown.last_signup_at ? new Date(shown.last_signup_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "Todavía no hay registros";
  return <section className="bo-detail">
    <div className="bo-detail-intro"><span className="bo-eyebrow">ACCESO PRIVADO · LISTA DE ESPERA</span><h2>Cuánta gente está esperando entrar.</h2><p>Solo se muestran cifras agregadas. Los correos siguen ocultos y nunca viajan al navegador.</p></div>
    <div className="bo-metrics bo-waitlist-metrics"><Metric label="Apuntadas" value={shown.total} detail="registros acumulados" tone="lime" icon={Users} /><Metric label="Activas" value={shown.active} detail="sin darse de baja" tone="blue" icon={UserPlus} /><Metric label="Esta semana" value={shown.new_last_7_days} detail="nuevas en 7 días" tone="lavender" icon={BarChart3} /><Metric label="Hoy" value={shown.new_today} detail="nuevas desde medianoche" tone="coral" icon={Bell} /></div>
    <div className="bo-columns">
      <section className="bo-panel"><PanelHeading eyebrow="RITMO" title="Última alta" action="Actualizar" onClick={() => window.location.reload()} /><div className="bo-waitlist-last"><strong>{lastSignup}</strong><span>La cifra se actualiza al recargar el panel.</span></div><div className="bo-analytics-list">{shown.sources.map(item => <div className="bo-analytics-row" key={item.source}><strong>{item.source === "roadmap" ? "Hoja de ruta" : "Portada"}</strong><span>{item.total} registros</span></div>)}</div></section>
      <section className="bo-panel bo-notify-panel"><div className="bo-panel-heading"><div><span className="bo-eyebrow">AVISOS · SOLO TÚ</span><h3>Llévatelo al móvil</h3></div><Bell size={18} /></div><p>Activa el aviso de este dispositivo para recibir una notificación cuando el panel detecte actividad mientras está abierto.</p><button className={"bo-notify-button " + (notifyEnabled ? "is-on" : "")} onClick={enableNotifications} disabled={notifyEnabled}><Bell size={16} />{notifyEnabled ? "Avisos activados" : "Activar avisos"}</button>{notifyMessage && <small role="status">{notifyMessage}</small>}<span className="bo-notify-note">Para avisos aunque el panel esté cerrado, configura también el correo privado de Resend en la Edge Function.</span></section>
    </div>
  </section>;
}
function AnalyticsPanel({ data }: { data: AnalyticsSnapshot | null }) {
  if (!data) return <section className="bo-detail"><div className="bo-feedback bo-feedback-loading" role="status"><span className="bo-spinner" />Cargando analítica…</div></section>;
  const minutes = Math.floor(data.avg_active_seconds / 60);
  const seconds = data.avg_active_seconds % 60;
  return <section className="bo-detail"><div className="bo-detail-intro"><span className="bo-eyebrow">USO · ÚLTIMOS {data.period_days} DÍAS</span><h2>Cómo entra y participa la comunidad.</h2><p>Datos propios y agregados. Las sesiones solo cuentan mientras la pestaña está visible.</p></div><div className="bo-metrics"><Metric label="Sesiones" value={data.sessions} detail={`${data.members} personas distintas`} tone="lime" icon={Users} /><Metric label="Ahora" value={data.active_now} detail="activas en los últimos 5 min" tone="blue" icon={BarChart3} /><Metric label="Tiempo activo" value={`${minutes}:${String(seconds).padStart(2, "0")}`} detail="media por sesión" tone="lavender" icon={ClipboardList} /></div><div className="bo-columns"><section className="bo-panel"><PanelHeading eyebrow="ENTRADAS" title="Páginas de llegada" action="Actualizar" onClick={() => window.location.reload()} /><div className="bo-analytics-list">{data.top_pages.length ? data.top_pages.map(item => <div className="bo-analytics-row" key={item.path}><strong>{item.path}</strong><span>{item.sessions} sesiones</span></div>) : <EmptyState text="Todavía no hay sesiones en este periodo." />}</div></section><section className="bo-panel"><PanelHeading eyebrow="ACCIONES" title="Qué se está usando" action="Actualizar" onClick={() => window.location.reload()} /><div className="bo-analytics-list">{data.top_events.length ? data.top_events.map(item => <div className="bo-analytics-row" key={item.event_name}><strong>{item.event_name}</strong><span>{item.events} eventos</span></div>) : <EmptyState text="Todavía no hay eventos en este periodo." />}</div></section></div></section>;
}
function Metric({ label, value, detail, tone, icon: Icon }: { label: string; value: string | number; detail: string; tone: string; icon: typeof BarChart3 }) { return <article className={`bo-metric bo-tone-${tone}`}><span className="bo-metric-icon"><Icon size={17} /></span><small>{label}</small><strong>{value}</strong><p>{detail}</p></article>; }
function PanelHeading({ eyebrow, title, action, onClick }: { eyebrow: string; title: string; action: string; onClick: () => void }) { return <header className="bo-panel-heading"><div><span className="bo-eyebrow">{eyebrow}</span><h3>{title}</h3></div><button onClick={onClick}>{action}<ArrowUpRight size={15} /></button></header>; }
function CaseRow({ item, compact = false, onResolve, busyAction }: { item: CaseItem; compact?: boolean; onResolve?: (id: string | number) => void; busyAction?: string | null }) { const busy = busyAction === `case-${item.id}`; return <article className={`bo-case-row ${item.state === "Resuelto" ? "is-resolved" : ""}`}><span className={`bo-priority bo-priority-${item.priority.toLowerCase()}`} /> <div className="bo-row-main"><small>{item.type} · {item.time}</small><strong>{item.title}</strong><p>{item.detail}</p></div><span className={`bo-state bo-state-${item.state.toLowerCase().replace(" ", "-")}`}>{item.state}</span>{!compact && item.state !== "Resuelto" && <div className="bo-row-actions"><button className="bo-primary-small" onClick={() => onResolve?.(item.id)} disabled={busy}>{busy ? <span className="bo-spinner bo-spinner-small" /> : <Check size={14} />}{busy ? "Guardando" : "Resolver"}</button><button className="bo-ghost-small" aria-label="Abrir caso"><ArrowUpRight size={14} /></button></div>}</article>; }
function ProposalRow({ item, compact = false, onState, busyAction }: { item: Proposal; compact?: boolean; onState?: (id: string | number, state: Exclude<Proposal["state"], "En revisión">) => void; busyAction?: string | null }) { const busy = busyAction === `proposal-${item.id}`; return <article className="bo-proposal-row"><span className="bo-proposal-tag">{item.section}</span><div className="bo-row-main"><small>{item.author} · {item.age}</small><strong>{item.title}</strong></div><span className={`bo-state bo-state-${item.state.toLowerCase().replace(" ", "-")}`}>{item.state}</span>{!compact && item.state === "En revisión" && <div className="bo-row-actions"><button className="bo-primary-small" onClick={() => onState?.(item.id, "Aceptada")} disabled={busy}>{busy ? <span className="bo-spinner bo-spinner-small" /> : <Check size={14} />}{busy ? "Guardando" : "Aceptar"}</button><button className="bo-ghost-small" onClick={() => onState?.(item.id, "Rechazada")} disabled={busy} aria-label="Rechazar propuesta"><X size={14} /></button></div>}</article>; }
function Moderation({ items, onResolve, busyAction }: { items: CaseItem[]; onResolve: (id: string | number) => void; busyAction?: string | null }) { const [filter, setFilter] = useState<"all" | "high" | "review">("all"); const visible = items.filter(item => filter === "all" || (filter === "high" ? item.priority === "Alta" : item.state === "En revisión")); return <section className="bo-detail"><div className="bo-detail-intro"><span className="bo-eyebrow">CONVIVENCIA</span><h2>Casos que merecen una mirada.</h2><p>Resuelve con contexto. Toda decisión queda registrada.</p></div><div className="bo-filter-line"><span>{items.filter(item => item.state !== "Resuelto").length} pendientes</span><button className={filter === "all" ? "bo-filter-active" : ""} onClick={() => setFilter("all")}>Todos</button><button className={filter === "high" ? "bo-filter-active" : ""} onClick={() => setFilter("high")}>Alta prioridad</button><button className={filter === "review" ? "bo-filter-active" : ""} onClick={() => setFilter("review")}>En revisión</button></div><div className="bo-list">{visible.length ? visible.map(item => <CaseRow key={item.id} item={item} onResolve={onResolve} busyAction={busyAction} />) : <EmptyState text="No hay casos que coincidan con este filtro." />}</div></section>; }
function Editorial({ items, onState, busyAction }: { items: Proposal[]; onState: (id: string | number, state: Exclude<Proposal["state"], "En revisión">) => void; busyAction?: string | null }) { return <section className="bo-detail"><div className="bo-detail-intro"><span className="bo-eyebrow">REDACCIÓN</span><h2>Lo que autorizan, se publica.</h2><p>Revisa cada propuesta y conserva la versión que su autor ha aprobado.</p></div><div className="bo-edition-strip"><span><Newspaper size={17} />Edición 03</span><strong>Esta semana en Entreclases</strong><small>Publicación prevista · jueves 24</small></div><div className="bo-list">{items.length ? items.map(item => <ProposalRow key={item.id} item={item} onState={onState} busyAction={busyAction} />) : <EmptyState text="No hay propuestas que coincidan con la búsqueda." />}</div></section>; }
function People({ query, people: sourcePeople }: { query: string; people?: Record<string, unknown>[] }) {
  const fallbackPeople = [
    { name: "Paula Martí", detail: "Diseño industrial · Tarongers", state: "Activa", initials: "PM" },
    { name: "Marc Ferrer", detail: "Derecho · Tarongers", state: "Activa", initials: "MF" },
    { name: "Laia Soler", detail: "Psicología · Blasco Ibáñez", state: "Revisión pendiente", initials: "LS" },
    { name: "Nico Vidal", detail: "Ingeniería informática · Vera", state: "Activa", initials: "NV" },
  ];
  const people = sourcePeople?.length
    ? sourcePeople.map(person => {
        const name = String(person.name ?? "Cuenta sin nombre");
        const initials = name.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join("").toUpperCase();
        return {
          name,
          detail: `${String(person.degree ?? "Estudios universitarios")} · ${String(person.campus ?? "València")}`,
          state: "Activa",
          initials: initials || "??",
        };
      })
    : fallbackPeople;
  const filtered = people.filter(person => `${person.name} ${person.detail}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="bo-detail"><div className="bo-detail-intro"><span className="bo-eyebrow">CUENTAS</span><h2>Gente con una cuenta aquí.</h2><p>Acceso, verificación y señales de cuidado de la comunidad.</p></div><div className="bo-people-grid">{filtered.map(person => <article className="bo-person-card" key={person.name}><span className="bo-person-avatar">{person.initials}</span><div><strong>{person.name}</strong><small>{person.detail}</small><span className={person.state === "Activa" ? "bo-person-live" : "bo-person-review"}>{person.state}</span></div><button aria-label={`Abrir ${person.name}`}><ArrowUpRight size={16} /></button></article>)}</div></section>;
}
function Coins() { return <section className="bo-detail"><div className="bo-detail-intro"><span className="bo-eyebrow">CLASIC OINS</span><h2>La participación deja rastro.</h2><p>Consulta movimientos, recompensas y ajustes con una explicación clara.</p></div><div className="bo-coins-balance"><div><small>Saldo total de la comunidad</small><strong>2.840 <span>ClasiCoins</span></strong><p>+18% frente a la semana pasada</p></div><CircleDollarSign size={42} /></div><div className="bo-list bo-coins-list">{[["Paula Martí", "+3", "Primera inscripción en un plan"], ["Marc Ferrer", "−5", "Hilo abierto en el foro"], ["Álex Torres", "+2", "Primera respuesta en un hilo"]].map(row => <div className="bo-coin-row" key={`${row[0]}-${row[1]}`}><span className={row[1].startsWith("+") ? "bo-coin-in" : "bo-coin-out"}>{row[1]}</span><div><strong>{row[0]}</strong><small>{row[2]}</small></div><time>Hoy, 09:20</time></div>)}</div></section>; }
function Settings({ games, onToggle, busyAction }: { games: { name: string; active: boolean; activity: string }[]; onToggle: (name: string) => void; busyAction?: string | null }) { return <section className="bo-detail"><div className="bo-detail-intro"><span className="bo-eyebrow">CONFIGURACIÓN</span><h2>Decidir también es cuidar.</h2><p>Activa experiencias por separado y mantén claro qué está ocurriendo.</p></div><div className="bo-settings-card"><div className="bo-settings-card-head"><div><strong>Juegos de Explorar</strong><small>Cada juego puede pausarse sin borrar su historial.</small></div><Sparkles size={20} /></div>{games.map(game => { const busy = busyAction === `game-${game.name}`; return <div className="bo-setting-row" key={game.name}><span className={`bo-game-status ${game.active ? "on" : ""}`} /><div><strong>{game.name}</strong><small>{game.activity}</small></div><button className={`bo-toggle ${game.active ? "is-on" : ""}`} onClick={() => onToggle(game.name)} disabled={busy} aria-pressed={game.active}>{busy ? <span className="bo-spinner bo-spinner-small" /> : game.active ? <Play size={13} /> : <Pause size={13} />}{busy ? "Guardando" : game.active ? "Activo" : "Pausado"}</button></div>; })}</div></section>; }
function EmptyState({ text }: { text: string }) { return <div className="bo-empty"><Search size={20} /><p>{text}</p></div>; }
function AccessGate({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <main className="bo-access"><div className="bo-access-mark">E</div><span className="bo-eyebrow">ENTRECLASE · EQUIPO</span><h1>Este espacio es para quienes cuidan la comunidad.</h1><p>{message}</p><div className="bo-access-actions"><a className="bo-primary-small" href="/login/">Iniciar sesión</a><button className="bo-ghost-small" onClick={onRetry}>Reintentar</button></div><small>Si solo quieres revisar la demo visual, añade <code>?demo=1</code> a la dirección.</small></main>;
}