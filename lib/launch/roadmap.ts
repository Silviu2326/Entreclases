import { LAUNCH_AT, LAUNCH_TIMESTAMP, LAUNCH_TIMEZONE } from "./config";
import type { Locale } from "../i18n/routes";

// Two weeks after the launch, and the last Monday of October. Both are written
// with the offset in force on that day: Spain leaves summer time on 25/10/2026.
export const PROJECTS_AT = "2026-10-12T00:00:00+02:00";
export const ANNOUNCEMENT_AT = "2026-10-26T00:00:00+01:00";

export type MilestoneId = "launch" | "projects" | "announcement";
export type MilestoneState = "done" | "next" | "later";
// Each text travels as [español, valencià]; the page picks the column.
export type Milestone = { id: MilestoneId; at: string; timestamp: number; step: string; heading: [string, string]; summary: [string, string]; detail: [string, string][] };

export const milestones: Milestone[] = [
 {
  id: "launch", at: LAUNCH_AT, timestamp: LAUNCH_TIMESTAMP, step: "01",
  heading: ["Entreclases abre en Valencia.", "Entreclases obri a València."],
  summary: [
   "Se abren las cuentas. Desde el primer día: planes para esta tarde, grupos, apuntes, gente de tu campus y mensajes privados.",
   "S’obrin els comptes. Des del primer dia: plans per a esta vesprada, grups, apunts, gent del teu campus i missatges privats.",
  ],
  detail: [
   ["Acceso con el correo de una universidad de Valencia.", "Accés amb el correu d’una universitat de València."],
   ["Cada cuenta verificada puede invitar a una persona de fuera.", "Cada compte verificat pot convidar una persona de fora."],
   ["En español y en valenciano desde la primera pantalla.", "En espanyol i en valencià des de la primera pantalla."],
  ],
 },
 {
  id: "projects", at: PROJECTS_AT, timestamp: Date.parse(PROJECTS_AT), step: "02",
  heading: ["Se abre Proyectos.", "S’obri Projectes."],
  summary: [
   "Dos semanas después del lanzamiento. Ideas que buscan manos: publicas la tuya, dices qué puestos necesitas y alguien de otra carrera se apunta.",
   "Dos setmanes després del llançament. Idees que busquen mans: publiques la teua, dius quins llocs necessites i algú d’una altra carrera s’hi apunta.",
  ],
  detail: [
   ["Una ficha con el objetivo, los puestos y qué aporta cada parte.", "Una fitxa amb l’objectiu, els llocs i què aporta cada part."],
   ["Solicitudes privadas: quien lo crea acepta o no.", "Sol·licituds privades: qui el crea accepta o no."],
   ["Al terminar, un resultado con los créditos de todo el equipo.", "En acabar, un resultat amb els crèdits de tot l’equip."],
  ],
 },
 {
  id: "announcement", at: ANNOUNCEMENT_AT, timestamp: Date.parse(ANNOUNCEMENT_AT), step: "03",
  heading: ["Tenemos algo que contar.", "Tenim alguna cosa a contar."],
  summary: [
   "El último lunes de octubre hacemos un anuncio. No es una función más de la lista: por eso tiene fecha propia.",
   "L’últim dilluns d’octubre fem un anunci. No és una funció més de la llista: per això té data pròpia.",
  ],
  detail: [
   ["Todavía no decimos qué es.", "Encara no diem què és."],
   ["Lo contamos primero a quien esté en la lista.", "Ho contem primer a qui estiga en la llista."],
  ],
 },
];

export function milestoneDate(at: string, locale: Locale, withYear = false) {
 return new Intl.DateTimeFormat(locale === "va" ? "ca-ES" : "es-ES", { timeZone: LAUNCH_TIMEZONE, weekday: "long", day: "numeric", month: "long", ...(withYear ? { year: "numeric" as const } : {}) }).format(Date.parse(at));
}

// Before hydration there is no clock: every milestone is still ahead, which is
// also what a visitor without JavaScript reads.
export function milestoneState(now: number | null, timestamp: number): MilestoneState {
 if (now === null) return "later";
 if (now >= timestamp) return "done";
 return timestamp === nextMilestone(now)?.timestamp ? "next" : "later";
}

export function nextMilestone(now: number | null) {
 if (now === null) return milestones[0];
 return milestones.find((milestone) => now < milestone.timestamp) ?? null;
}
