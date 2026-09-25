// Pure data model and logic for "Mi semana" (classes, deliveries, exams).
// No React here: everything is plain functions so it can be unit tested
// without mounting the component. Dates are always "YYYY-MM-DD" strings
// standing for a calendar day in Europe/Madrid; times are "HH:MM".

export type Course = { id: string; name: string; color: number };

export type ClassSlot = {
  id: string;
  courseId: string;
  /** 1 = Monday … 7 = Sunday, like ISO weekday. */
  weekday: number;
  start: string;
  end: string;
  room: string;
  /** Optional bounds for the weekly recurrence. */
  from?: string;
  until?: string;
};

export type DeadlineKind = "delivery" | "exam" | "other";

export type Deadline = {
  id: string;
  courseId: string | null;
  title: string;
  kind: DeadlineKind;
  date: string;
  time?: string;
  note?: string;
  done: boolean;
};

export type CalendarState = { courses: Course[]; classes: ClassSlot[]; deadlines: Deadline[] };

export function emptyState(): CalendarState {
  return { courses: [], classes: [], deadlines: [] };
}

export const COURSE_COLORS = 7;

// A tiny id generator, kept local so this file has no dependency on React
// or on the storage module (which is marked "use client").
export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

// ---- Dates in Europe/Madrid, as plain "YYYY-MM-DD" arithmetic ----

const pad = (n: number) => String(n).padStart(2, "0");

function toUTCms(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Today's date in Europe/Madrid, same technique as `coinDay` in lib/community/unicoins.ts. */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, amount: number): string {
  const dt = new Date(toUTCms(date) + amount * 86400000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** How many days `date` is after `base` (negative when it is before). */
export function diffDays(date: string, base: string): number {
  return Math.round((toUTCms(date) - toUTCms(base)) / 86400000);
}

/** 1 = Monday … 7 = Sunday. */
export function weekdayOf(date: string): number {
  const day = new Date(toUTCms(date)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function startOfWeek(date: string): string {
  return addDays(date, -(weekdayOf(date) - 1));
}

/** Long localized date, e.g. "miércoles, 24 de septiembre de 2026". Noon UTC keeps the
 * calendar day stable in Europe/Madrid (always UTC+1 or UTC+2, never behind). */
export function formatLongDate(date: string, locale: string): string {
  const at = new Date(toUTCms(date) + 12 * 3600000);
  return new Intl.DateTimeFormat(locale === "va" ? "ca-ES" : "es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(at);
}

/** Short localized date, e.g. "24 sept." */
export function formatShortDate(date: string, locale: string): string {
  const at = new Date(toUTCms(date) + 12 * 3600000);
  return new Intl.DateTimeFormat(locale === "va" ? "ca-ES" : "es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }).format(at);
}

/** Short weekday name, e.g. "jue." — used for the week grid's column headers. */
export function formatWeekdayShort(date: string, locale: string): string {
  const at = new Date(toUTCms(date) + 12 * 3600000);
  return new Intl.DateTimeFormat(locale === "va" ? "ca-ES" : "es-ES", { weekday: "short", timeZone: "Europe/Madrid" }).format(at);
}

function classOccursOn(slot: ClassSlot, date: string): boolean {
  return slot.weekday === weekdayOf(date) && (!slot.from || date >= slot.from) && (!slot.until || date <= slot.until);
}

// ---- Today, the week, and what is coming up ----

export type AgendaClass = ClassSlot & { course: Course | null };

function withCourse(state: CalendarState, slot: ClassSlot): AgendaClass {
  return { ...slot, course: state.courses.find(course => course.id === slot.courseId) ?? null };
}

export type TodayAgenda = { classes: AgendaClass[]; deadlines: Deadline[] };

export function todayAgenda(state: CalendarState, today: string): TodayAgenda {
  const classes = state.classes
    .filter(slot => classOccursOn(slot, today))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(slot => withCourse(state, slot));
  const deadlines = state.deadlines
    .filter(deadline => deadline.date === today)
    .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  return { classes, deadlines };
}

export type WeekDay = { date: string; weekday: number; classes: AgendaClass[] };

export function weekGrid(state: CalendarState, weekStart: string): WeekDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const classes = state.classes
      .filter(slot => classOccursOn(slot, date))
      .sort((a, b) => a.start.localeCompare(b.start))
      .map(slot => withCourse(state, slot));
    return { date, weekday: weekdayOf(date), classes };
  });
}

export type Urgency = "past" | "today" | "soon" | "week" | "later";

/** How pressing something is, from how many days are left until it. */
export function urgency(daysLeft: number): Urgency {
  if (daysLeft < 0) return "past";
  if (daysLeft === 0) return "today";
  if (daysLeft <= 3) return "soon";
  if (daysLeft <= 7) return "week";
  return "later";
}

export type UpcomingItem = { deadline: Deadline; daysLeft: number; urgency: Urgency };

/** Not-done deliveries and exams due within `days`, plus anything overdue (negative daysLeft). */
export function upcoming(state: CalendarState, today: string, days = 14): UpcomingItem[] {
  return state.deadlines
    .filter(deadline => !deadline.done)
    .map(deadline => {
      const daysLeft = diffDays(deadline.date, today);
      return { deadline, daysLeft, urgency: urgency(daysLeft) };
    })
    .filter(item => item.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft || (a.deadline.time ?? "99:99").localeCompare(b.deadline.time ?? "99:99"));
}

// ---- Importing a university's .ics export ----

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescapeText(value: string): string {
  return value.replace(/\\([\\,;nN])/g, (_match, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function propValue(line: string): string {
  const idx = line.indexOf(":");
  return idx === -1 ? "" : line.slice(idx + 1);
}

/** Parses DTSTART/DTEND, with or without a TZID param, and with a trailing Z (UTC). */
function parseDt(line: string): { date: string; time?: string } | undefined {
  const value = propValue(line).trim();
  const utc = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (utc) {
    const [, y, mo, d, h, mi, s] = utc;
    const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(ms));
    const get = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
    return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
  }
  const local = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (local) {
    const [, y, mo, d, h, mi] = local;
    return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
  }
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly;
    return { date: `${y}-${mo}-${d}` };
  }
  return undefined;
}

function parseUntilFromRRule(rrule: string): string | undefined {
  const match = /UNTIL=(\d{4})(\d{2})(\d{2})/.exec(rrule);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + minutes + 24 * 60) % (24 * 60);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** No AI here: a small keyword guess, since university .ics exports rarely say the kind explicitly. */
function guessKind(summary: string): DeadlineKind {
  const text = normalize(summary);
  if (text.includes("exam") || text.includes("parcial")) return "exam";
  if (text.includes("entreg") || text.includes("deadline") || text.includes("lliurament") || text.includes("trabajo") || text.includes("treball")) return "delivery";
  return "other";
}

export type IcsClassDraft = { courseName: string; weekday: number; start: string; end: string; room: string; from?: string; until?: string };
export type IcsDeadlineDraft = { courseName: string | null; title: string; kind: DeadlineKind; date: string; time?: string; note?: string };
export type ParsedIcs = { classes: IcsClassDraft[]; deadlines: IcsDeadlineDraft[] };

const TRACKED_PROPS = ["DTSTART", "DTEND", "SUMMARY", "LOCATION", "RRULE"] as const;
type TrackedProp = (typeof TRACKED_PROPS)[number];

/**
 * Reads a basic .ics export (the kind a university's virtual classroom produces):
 * VEVENT blocks with DTSTART/DTEND/SUMMARY/LOCATION. A weekly RRULE turns the event
 * into a recurring ClassSlot; anything else becomes a one-off Deadline. Not a full
 * RFC 5545 parser — just folded lines, `\,`-style escapes, and DTSTART with a TZID
 * or a trailing Z, which is what these exports actually use.
 */
export function parseIcs(text: string): ParsedIcs {
  const classes: IcsClassDraft[] = [];
  const deadlines: IcsDeadlineDraft[] = [];
  let inEvent = false;
  let props: Partial<Record<TrackedProp, string>> = {};

  const flush = () => {
    if (!props.DTSTART) return;
    const start = parseDt(props.DTSTART);
    if (!start) return;
    const end = props.DTEND ? parseDt(props.DTEND) : undefined;
    const summary = props.SUMMARY ? unescapeText(propValue(props.SUMMARY)).trim() : "";
    const location = props.LOCATION ? unescapeText(propValue(props.LOCATION)).trim() : "";
    const weekly = props.RRULE ? /FREQ=WEEKLY/i.test(props.RRULE) : false;
    if (weekly && start.time) {
      classes.push({
        courseName: summary || "Asignatura importada",
        weekday: weekdayOf(start.date),
        start: start.time,
        end: end?.time ?? addMinutesToTime(start.time, 60),
        room: location,
        from: start.date,
        until: parseUntilFromRRule(props.RRULE ?? ""),
      });
    } else {
      deadlines.push({
        courseName: null,
        title: summary || "Sin título",
        kind: guessKind(summary),
        date: start.date,
        time: start.time,
        note: location || undefined,
      });
    }
  };

  for (const raw of unfold(text)) {
    const line = raw.trim();
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") { inEvent = true; props = {}; continue; }
    if (upper === "END:VEVENT") { if (inEvent) flush(); inEvent = false; continue; }
    if (!inEvent) continue;
    const name = line.split(/[:;]/, 1)[0].toUpperCase();
    if ((TRACKED_PROPS as readonly string[]).includes(name)) props[name as TrackedProp] = line;
  }
  return { classes, deadlines };
}

export type ImportResult = { state: CalendarState; addedClasses: number; addedDeadlines: number; duplicateClasses: number; duplicateDeadlines: number };

/**
 * Merges a parsed .ics into the current state. Classes are matched to an existing
 * course by name (case-insensitive) or create a new one. Duplicates are skipped:
 * a class already on the same course/weekday/time, or a deadline with the same
 * title + date (the rule the product asked for) already present.
 */
export function importIcs(state: CalendarState, text: string): ImportResult {
  const parsed = parseIcs(text);
  let courses = [...state.courses];
  let classes = [...state.classes];
  let deadlines = [...state.deadlines];
  let addedClasses = 0, addedDeadlines = 0, duplicateClasses = 0, duplicateDeadlines = 0;

  const findOrCreateCourse = (name: string): Course => {
    const trimmed = name.trim() || "Asignatura importada";
    const existing = courses.find(course => course.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const created: Course = { id: newId(), name: trimmed, color: courses.length % COURSE_COLORS };
    courses = [...courses, created];
    return created;
  };

  for (const draft of parsed.classes) {
    const course = findOrCreateCourse(draft.courseName);
    const isDuplicate = classes.some(slot => slot.courseId === course.id && slot.weekday === draft.weekday && slot.start === draft.start);
    if (isDuplicate) { duplicateClasses += 1; continue; }
    classes = [...classes, { id: newId(), courseId: course.id, weekday: draft.weekday, start: draft.start, end: draft.end, room: draft.room, from: draft.from, until: draft.until }];
    addedClasses += 1;
  }
  for (const draft of parsed.deadlines) {
    const isDuplicate = deadlines.some(deadline => deadline.title.trim().toLowerCase() === draft.title.trim().toLowerCase() && deadline.date === draft.date);
    if (isDuplicate) { duplicateDeadlines += 1; continue; }
    deadlines = [...deadlines, { id: newId(), courseId: null, title: draft.title, kind: draft.kind, date: draft.date, time: draft.time, note: draft.note, done: false }];
    addedDeadlines += 1;
  }
  return { state: { courses, classes, deadlines }, addedClasses, addedDeadlines, duplicateClasses, duplicateDeadlines };
}

// ---- Exporting to .ics ----

const BY_DAY: Record<number, string> = { 1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR", 6: "SA", 7: "SU" };

function compactDate(date: string): string {
  return date.replace(/-/g, "");
}

function compactTime(time: string): string {
  return `${time.replace(":", "")}00`;
}

/** A deterministic first occurrence for a weekly class: the earliest date on or
 * after `from` (or a fixed anchor, if there is no `from`) that falls on `weekday`. */
function anchorForWeekday(weekday: number, from?: string): string {
  const base = from ?? "2024-01-01";
  const offset = (weekday - weekdayOf(base) + 7) % 7;
  return addDays(base, offset);
}

/** Writes classes and deadlines back out as a basic .ics, readable by any calendar app. */
export function toIcs(state: CalendarState): string {
  const courseName = (id: string | null) => state.courses.find(course => course.id === id)?.name ?? "";
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Entreclases//Mi semana//ES", "CALSCALE:GREGORIAN"];

  for (const slot of state.classes) {
    const anchor = anchorForWeekday(slot.weekday, slot.from);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:class-${slot.id}@entreclases`);
    lines.push(`DTSTART;TZID=Europe/Madrid:${compactDate(anchor)}T${compactTime(slot.start)}`);
    lines.push(`DTEND;TZID=Europe/Madrid:${compactDate(anchor)}T${compactTime(slot.end)}`);
    lines.push(`SUMMARY:${escapeText(courseName(slot.courseId) || "Clase")}`);
    if (slot.room) lines.push(`LOCATION:${escapeText(slot.room)}`);
    const until = slot.until ? `;UNTIL=${compactDate(slot.until)}T235959Z` : "";
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${BY_DAY[slot.weekday]}${until}`);
    lines.push("END:VEVENT");
  }
  for (const deadline of state.deadlines) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:deadline-${deadline.id}@entreclases`);
    if (deadline.time) lines.push(`DTSTART;TZID=Europe/Madrid:${compactDate(deadline.date)}T${compactTime(deadline.time)}`);
    else lines.push(`DTSTART;VALUE=DATE:${compactDate(deadline.date)}`);
    lines.push(`SUMMARY:${escapeText(deadline.title)}`);
    const note = [courseName(deadline.courseId), deadline.note].filter(Boolean).join(" · ");
    if (note) lines.push(`LOCATION:${escapeText(note)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
