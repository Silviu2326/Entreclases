import { valencianMessages } from "./messages-va";
import type { Locale } from "./routes";
export { routes, localPath, localHref, type Locale, type RouteName } from "./routes";

export function createTranslator(locale: Locale) {
 return (source: string): string => locale === "va" ? (valencianMessages[source.trim().replace(/\s+/g, " ")] ?? source) : source;
}
