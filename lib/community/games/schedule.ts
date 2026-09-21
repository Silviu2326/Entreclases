import { useSyncExternalStore } from "react";

// La ronda semanal de La cita empieza hablando: los jueves a las 19:30, hora de
// València. Inicio y Explorar la anuncian con el mismo texto.
type Text = readonly [string, string];
export const blindRound = { weekday: 4, hour: 19, minute: 30, timeZone: "Europe/Madrid" } as const;
export const blindRoundTime = `${blindRound.hour}:${String(blindRound.minute).padStart(2, "0")}`;
export const blindRoundWeekday: Text = ["Jueves", "Dijous"];

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const format = new Intl.DateTimeFormat("en-US", { timeZone: blindRound.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
function madridParts(date: Date) {
  const part = Object.fromEntries(format.formatToParts(date).map(entry => [entry.type, entry.value]));
  return { year: +part.year, month: +part.month, day: +part.day, hour: +part.hour, minute: +part.minute, weekday: weekdays.indexOf(part.weekday) };
}

// El próximo inicio (o el de hoy, si aún no ha llegado) y cuántos días faltan en el calendario de València.
export function nextBlindRound(now: Date = new Date()): { start: Date; days: number } {
  const here = madridParts(now), at = blindRound.hour * 60 + blindRound.minute;
  let days = (blindRound.weekday - here.weekday + 7) % 7;
  if (!days && here.hour * 60 + here.minute >= at) days = 7;
  const offset = Date.UTC(here.year, here.month - 1, here.day, here.hour, here.minute) - Math.floor(now.getTime() / 60_000) * 60_000;
  let start = Date.UTC(here.year, here.month - 1, here.day + days, blindRound.hour, blindRound.minute) - offset;
  // Si entre medias cambia la hora (marzo, octubre), se corrige con la hora real de ese día.
  const check = madridParts(new Date(start));
  start += (at - (check.hour * 60 + check.minute)) * 60_000;
  return { start: new Date(start), days };
}

export function blindRoundLabel(language: number, now: Date = new Date()): string {
  const { days } = nextBlindRound(now);
  const text: Text = days === 0 ? [`Empieza hoy a las ${blindRoundTime}`, `Comença hui a les ${blindRoundTime}`]
    : days === 1 ? ["Empieza mañana", "Comença demà"]
    : [`Empieza en ${days} días`, `Comença en ${days} dies`];
  return text[language];
}

// La hora del navegador, al minuto. En el servidor y al hidratar es null, así que
// los textos relativos se pintan solo después de montar y no hay desajustes.
const minute = () => Math.floor(Date.now() / 60_000);
function subscribeMinute(onChange: () => void) {
  const timer = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(timer);
}
export function useNow(): Date | null {
  const now = useSyncExternalStore(subscribeMinute, minute, () => null);
  return now === null ? null : new Date(now * 60_000);
}
