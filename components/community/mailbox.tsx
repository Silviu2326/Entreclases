"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Bell, CalendarDays, CheckCheck, ChevronRight, CircleAlert, Mail, MessageCircle, Sparkles, Users } from "lucide-react";

import type { View } from "@/lib/community/types";

import { useCommunity } from "./context";

type MailboxFilter = "all" | "unread" | "invites";
type NoticeKind = "plan" | "reply" | "project" | "invite";
type Notice = { id: string; kind: NoticeKind; title: string; body: string; time: string; label: string; view: View; unread: boolean };

const iconFor: Record<NoticeKind, typeof Bell> = { plan: CalendarDays, reply: MessageCircle, project: Sparkles, invite: Users };

export function MailboxPage() {
  const { locale, go, c } = useCommunity();
  const [filter, setFilter] = useState<MailboxFilter>("all");
  const [selectedId, setSelectedId] = useState("plan");
  const [readIds, setReadIds] = useState<string[]>([]);
  const notices = useMemo<Notice[]>(() => locale === "va" ? [
    { id: "plan", kind: "plan", label: "PLA · HUI", title: "Paula t’ha apuntat a un pla", body: "Café en Benimaclet. Ja sou tres i encara queda lloc per a una persona més.", time: "Fa 18 min", view: "plans", unread: true },
    { id: "reply", kind: "reply", label: "FIL · AHIR", title: "Han respost al teu fil", body: "La pregunta sobre la biblioteca ha obert una conversa amb quatre respostes noves.", time: "Ahir, 18:42", view: "messages", unread: true },
    { id: "project", kind: "project", label: "PROJECTE · AHIR", title: "El teu projecte té novetats", body: "Hi ha una nova sol·licitud per a sumar-se al projecte del probador virtual.", time: "Ahir, 12:10", view: "explore", unread: false },
    { id: "invite", kind: "invite", label: "GRUP · DILLUNS", title: "T’han convidat a un grup", body: "Els del tema 4 han compartit un resum nou i t’han deixat una invitació.", time: "Dilluns, 09:20", view: "groups", unread: false },
  ] : [
    { id: "plan", kind: "plan", label: "PLAN · HOY", title: "Paula te ha apuntado a un plan", body: "Café en Benimaclet. Ya sois tres y todavía queda sitio para una persona más.", time: "Hace 18 min", view: "plans", unread: true },
    { id: "reply", kind: "reply", label: "HILO · AYER", title: "Han respondido a tu hilo", body: "La pregunta sobre la biblioteca ha abierto una conversación con cuatro respuestas nuevas.", time: "Ayer, 18:42", view: "messages", unread: true },
    { id: "project", kind: "project", label: "PROYECTO · AYER", title: "Tu proyecto tiene novedades", body: "Hay una nueva solicitud para sumarse al proyecto del probador virtual.", time: "Ayer, 12:10", view: "explore", unread: false },
    { id: "invite", kind: "invite", label: "GRUPO · LUNES", title: "Te han invitado a un grupo", body: "Los del tema 4 han compartido un resumen nuevo y te han dejado una invitación.", time: "Lunes, 09:20", view: "groups", unread: false },
  ], [locale]);
  const isRead = (notice: Notice) => readIds.includes(notice.id) || !notice.unread;
  const unreadCount = notices.filter(notice => !isRead(notice)).length;
  const visible = notices.filter(notice => filter === "all" || (filter === "unread" ? !isRead(notice) : notice.kind === "invite"));
  const selected = notices.find(notice => notice.id === selectedId) ?? visible[0] ?? notices[0];
  const Icon = iconFor[selected.kind];
  const markRead = (id: string) => setReadIds(current => current.includes(id) ? current : [...current, id]);
  const changeFilter = (value: MailboxFilter) => { setFilter(value); const next = notices.filter(notice => value === "all" || (value === "unread" ? !isRead(notice) : notice.kind === "invite")); if (next[0]) setSelectedId(next[0].id); };

  return <div className="u-mailbox-page">
    <header className="u-mailbox-page-intro">
      <div>
        <p className="u-mailbox-kicker"><Mail aria-hidden="true"/> {c("mailbox")}</p>
        <h2>{c("mailboxTitle")}</h2>
        <p>{c("mailboxSub")}</p>
      </div>
      <div className="u-mailbox-pulse" aria-label={`${unreadCount} ${locale === "va" ? "avisos pendents" : "avisos pendientes"}`}><span>{unreadCount}</span><small>{locale === "va" ? "pendents" : "pendientes"}</small><Bell aria-hidden="true"/></div>
    </header>

    <div className="u-mailbox-toolbar">
      <div className="u-mailbox-filters" role="tablist" aria-label={locale === "va" ? "Filtrar avisos" : "Filtrar avisos"}>
        {([["all", locale === "va" ? "Tots" : "Todos"], ["unread", locale === "va" ? "Per llegir" : "Sin leer"], ["invites", locale === "va" ? "Invitacions" : "Invitaciones"]] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? "is-active" : ""} onClick={() => changeFilter(value)}>{label}{value === "unread" && unreadCount > 0 && <span>{unreadCount}</span>}</button>)}
      </div>
      <button className="u-mailbox-mark-all" type="button" onClick={() => setReadIds(notices.map(notice => notice.id))}><CheckCheck aria-hidden="true"/> {locale === "va" ? "Marcar-ho tot com llegit" : "Marcar todo como leído"}</button>
    </div>

    <div className="u-mailbox-layout">
      <section className="u-mailbox-feed" aria-label={locale === "va" ? "Avisos del teu compte" : "Avisos de tu cuenta"}>
        {visible.length ? visible.map(notice => { const NoticeIcon = iconFor[notice.kind]; const read = isRead(notice); return <button key={notice.id} type="button" className={`u-mailbox-row ${selected.id === notice.id ? "is-selected" : ""} ${read ? "is-read" : "is-unread"}`} onClick={() => { setSelectedId(notice.id); markRead(notice.id); }}><span className={`u-mailbox-row-icon u-mailbox-row-icon-${notice.kind}`}><NoticeIcon aria-hidden="true"/></span><span className="u-mailbox-row-copy"><small>{notice.label}</small><strong>{notice.title}</strong><span>{notice.body}</span><time>{notice.time}</time></span><ChevronRight aria-hidden="true"/></button>; }) : <div className="u-mailbox-empty"><CircleAlert aria-hidden="true"/><strong>{locale === "va" ? "Ací no hi ha avisos." : "Aquí no hay avisos."}</strong><span>{locale === "va" ? "Quan passe alguna cosa, la trobaràs ací." : "Cuando pase algo, lo encontrarás aquí."}</span></div>}
      </section>

      <article className="u-mailbox-detail" aria-live="polite">
        <div className={`u-mailbox-detail-icon u-mailbox-row-icon-${selected.kind}`}><Icon aria-hidden="true"/></div>
        <p className="u-mailbox-kicker">{selected.label}</p>
        <h3>{selected.title}</h3>
        <p>{selected.body}</p>
        <div className="u-mailbox-detail-meta"><span>{selected.time}</span><span>{locale === "va" ? "Només per a tu" : "Solo para ti"}</span></div>
        <button className="u-button u-mailbox-open" type="button" onClick={() => go(selected.view)}>{locale === "va" ? "Obrir en Entreclase" : "Abrir en Entreclase"}<ArrowUpRight aria-hidden="true"/></button>
      </article>
    </div>
    <p className="u-mailbox-footnote"><Sparkles aria-hidden="true"/> {locale === "va" ? "El teu buzó només reuneix activitat personal. Les converses privades continuen a Xarrades." : "Tu buzón solo reúne actividad personal. Las conversaciones privadas siguen en Charlas."}</p>
  </div>;
}
