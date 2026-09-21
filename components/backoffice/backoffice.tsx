"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  CircleDollarSign,
  Compass,
  Flag,
  Home,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { dashboardMetrics, navItems, pulse, reviewCases, type BackofficeCase, type BackofficeSection } from "./data";
import "./backoffice.css";

const iconBySection = { overview: Home, people: UsersRound, moderation: ShieldCheck, explore: Compass, magazine: BookOpen, coins: CircleDollarSign, settings: Settings2 } satisfies Record<BackofficeSection, typeof Home>;

function Avatar({ initials, color }: Pick<BackofficeCase, "initials" | "color">) {
  return <span className={`bo-avatar bo-avatar-${color}`}>{initials}</span>;
}

function Metric({ label, value, note, tone }: (typeof dashboardMetrics)[number]) {
  return <article className={`bo-metric bo-metric-${tone}`}><span>{label}</span><strong>{value}</strong><small><ArrowUpRight aria-hidden="true" />{note}</small><i aria-hidden="true" /></article>;
}

function CaseRow({ item, selected, onClick }: { item: BackofficeCase; selected: boolean; onClick: () => void }) {
  return <button type="button" className={`bo-case-row ${selected ? "is-selected" : ""}`} onClick={onClick}>
    <Avatar initials={item.initials} color={item.color} />
    <span className="bo-case-copy"><small><span className={`bo-dot bo-dot-${item.color}`} />{item.kind} · {item.age}</small><strong>{item.title}</strong><span>{item.detail}</span></span>
    <span className={`bo-priority bo-priority-${item.priority === "Alta" ? "high" : "normal"}`}>{item.priority === "Alta" ? "Atención" : "Revisar"}<ChevronRight aria-hidden="true" /></span>
  </button>;
}

function Overview({ selected, setSelected }: { selected: BackofficeCase | null; setSelected: (item: BackofficeCase) => void }) {
  const [filter, setFilter] = useState("Todo");
  const filtered = reviewCases.filter(item => filter === "Todo" || item.kind === filter);
  return <>
    <section className="bo-hero"><div><p className="bo-eyebrow">CENTRO DE CONTROL · VALÈNCIA</p><h1>Lo que necesita una decisión.</h1><p>La comunidad se mueve. Aquí tienes lo importante para cuidarla, editarla y hacer que siga pasando.</p></div><div className="bo-hero-mark" aria-hidden="true"><Sparkles /><span>hoy</span></div></section>
    <section className="bo-metrics" aria-label="Indicadores de la comunidad">{dashboardMetrics.map(metric => <Metric key={metric.label} {...metric} />)}</section>
    <div className="bo-dashboard-grid"><section className="bo-panel bo-inbox"><div className="bo-panel-head"><div><p className="bo-kicker">TU BANDEJA</p><h2>Decisiones para hoy</h2></div><span className="bo-count">{filtered.length} abiertos</span></div><div className="bo-filters" role="group" aria-label="Filtrar bandeja">{["Todo", "Moderación", "Revista", "Proyecto", "Soporte"].map(value => <button key={value} type="button" className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{value}</button>)}</div><div className="bo-case-list">{filtered.map(item => <CaseRow key={item.id} item={item} selected={selected?.id === item.id} onClick={() => setSelected(item)} />)}</div><button className="bo-underlined-action" type="button" onClick={() => setFilter("Todo")}>Ver toda la bandeja <ArrowUpRight aria-hidden="true" /></button></section><aside className="bo-panel bo-pulse"><div className="bo-panel-head"><div><p className="bo-kicker">SE ESTÁ MOVIENDO</p><h2>La comunidad, en una mirada.</h2></div><span className="bo-live"><i />Ahora</span></div><div className="bo-pulse-list">{pulse.map(item => <div className={`bo-pulse-item bo-pulse-${item.tone}`} key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></div>)}</div><div className="bo-note"><span>↗</span><p>Los proyectos que aparecen en Entre líneas reciben un 34% más de solicitudes.</p></div></aside></div>
  </>;
}

function SectionPlaceholder({ section }: { section: BackofficeSection }) {
  const copy: Record<BackofficeSection, { title: string; body: string; items: string[] }> = {
    overview: { title: "Resumen", body: "La actividad de Entreclase, lista para tu siguiente decisión.", items: [] },
    people: { title: "Personas", body: "Busca cuentas, comprueba su estado y cuida el acceso a la comunidad.", items: ["Nuevas verificaciones · 24", "Solicitudes de soporte · 6", "Cuentas pendientes · 11"] },
    moderation: { title: "Moderación", body: "Casos, reclamaciones y decisiones de convivencia en un mismo lugar.", items: ["4 casos de prioridad alta", "7 reclamaciones abiertas", "3 contenidos ocultos hoy"] },
    explore: { title: "Explorar", body: "Planes, grupos, proyectos y juegos que están dando vida al campus.", items: ["27 solicitudes en proyectos", "14 planes con participantes", "7 juegos activos"] },
    magazine: { title: "Entre líneas", body: "Revisa propuestas, permisos y próximas piezas de la revista.", items: ["9 propuestas por revisar", "3 autorizaciones pendientes", "Edición 03 en preparación"] },
    coins: { title: "ClasiCoins", body: "Sigue el movimiento de la moneda y resuelve incidencias con trazabilidad.", items: ["1.842 movimientos esta semana", "12 ajustes pendientes", "0 alertas de abuso"] },
    settings: { title: "Configuración", body: "Reglas de acceso, campus, roles y servicios que sostienen la plataforma.", items: ["3 campus activos", "4 roles internos", "Todo funciona correctamente"] },
  };
  const current = copy[section];
  return <section className="bo-section-view"><p className="bo-eyebrow">BACKOFFICE · {current.title.toUpperCase()}</p><h1>{current.title}</h1><p>{current.body}</p><div className="bo-section-list">{current.items.map((item, index) => <div key={item}><span>0{index + 1}</span><strong>{item}</strong><ArrowUpRight aria-hidden="true" /></div>)}</div><div className="bo-empty-hint"><Sparkles aria-hidden="true" /><span>Esta vista ya está preparada para conectar sus datos reales.</span></div></section>;
}

export function Backoffice() {
  const [section, setSection] = useState<BackofficeSection>("overview");
  const [selected, setSelected] = useState<BackofficeCase | null>(null);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [resolved, setResolved] = useState<string[]>([]);
  const closeDetail = () => setSelected(null);
  const resolveSelected = () => { if (!selected) return; setResolved(current => current.includes(selected.id) ? current : [...current, selected.id]); setSelected(null); };
  const chooseSection = (id: BackofficeSection) => { setSection(id); setMenuOpen(false); setSelected(null); };
  return <div className="bo-app">
    <aside className={`bo-sidebar ${menuOpen ? "is-open" : ""}`}><div className="bo-brand"><span className="bo-brand-glyph">e</span><span>entreclase</span></div><div className="bo-side-context"><i />Panel interno <span>València</span></div><nav aria-label="Secciones del backoffice"><p className="bo-nav-label">GESTIONAR</p>{navItems.map(item => { const Icon = iconBySection[item.id]; return <button key={item.id} type="button" className={section === item.id ? "is-active" : ""} onClick={() => chooseSection(item.id)}><Icon aria-hidden="true" /><span>{item.label}</span>{item.note && <small>{item.note}</small>}</button>; })}</nav><div className="bo-sidebar-foot"><div className="bo-admin-avatar">AT</div><div><strong>Álex Torres</strong><span>Administrador</span></div><button type="button" aria-label="Abrir configuración" onClick={() => chooseSection("settings")}><Settings2 aria-hidden="true" /></button></div></aside>
    <main className="bo-main"><header className="bo-topbar"><button type="button" className="bo-menu-button" aria-label="Abrir menú" onClick={() => setMenuOpen(value => !value)}><Menu /></button><div className="bo-breadcrumb"><span>Entreclase</span><ChevronRight aria-hidden="true" /><strong>Backoffice</strong></div><div className="bo-top-actions"><label className="bo-search"><Search aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar en el panel" aria-label="Buscar en el panel" /></label><button type="button" className="bo-notification" aria-label="Notificaciones"><Bell /><i>3</i></button><span className="bo-top-avatar">AT</span></div></header><div className="bo-content">{section === "overview" ? <Overview selected={selected} setSelected={setSelected} /> : <SectionPlaceholder section={section} />}</div></main>
    {selected && <div className="bo-drawer-backdrop" role="presentation" onClick={closeDetail}><aside className="bo-drawer" role="dialog" aria-modal="true" aria-labelledby="bo-drawer-title" onClick={event => event.stopPropagation()}><button type="button" className="bo-drawer-close" onClick={closeDetail} aria-label="Cerrar detalle"><X /></button><p className="bo-kicker">{selected.kind} · {selected.age}</p><h2 id="bo-drawer-title">{selected.title}</h2><div className="bo-drawer-person"><Avatar initials={selected.initials} color={selected.color} /><div><strong>{selected.person}</strong><span>Universitat de València · miembro verificado</span></div></div><p className="bo-drawer-copy">{selected.detail}</p><div className="bo-drawer-check"><Flag aria-hidden="true" /><div><strong>Qué revisar</strong><span>Comprueba el contexto completo, el historial y la autorización antes de decidir.</span></div></div><div className="bo-drawer-actions"><button type="button" className="bo-primary-action" onClick={resolveSelected}><Check aria-hidden="true" />Marcar resuelto</button><button type="button" className="bo-secondary-action" onClick={closeDetail}>Dejar para después</button></div></aside></div>}
    {resolved.length > 0 && <div className="bo-toast" role="status"><Check aria-hidden="true" />Caso resuelto. La bandeja está al día.</div>}
  </div>;
}
