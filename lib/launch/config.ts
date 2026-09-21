export const LAUNCH_AT = "2026-09-28T00:00:00+02:00";
export const LAUNCH_TIMESTAMP = Date.parse(LAUNCH_AT);
export const LAUNCH_TIMEZONE = "Europe/Madrid";
export type LaunchPhase = "scheduled" | "pending" | "open";

export function launchPhase(now: number | null, ready: boolean): LaunchPhase {
 if (now === null || now < LAUNCH_TIMESTAMP) return "scheduled";
 return ready ? "open" : "pending";
}
export function countdown(now: number | null) {
 if (now === null) return null;
 const seconds = Math.max(0, Math.ceil((LAUNCH_TIMESTAMP - now) / 1000));
 return { days: Math.floor(seconds / 86400), hours: Math.floor(seconds % 86400 / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 };
}
export function launchDate(locale: "es" | "va", full = false) {
 return new Intl.DateTimeFormat(locale === "va" ? "ca-ES" : "es-ES", { timeZone: LAUNCH_TIMEZONE, day: "numeric", month: "long", ...(full ? { year: "numeric" as const } : {}) }).format(LAUNCH_TIMESTAMP);
}
