import type { Locale } from "../i18n/routes";
import { routes } from "../i18n/routes";
import { siteOrigin } from "../i18n/metadata";
import { parseMarkdown, readingMinutes } from "./markdown";
import { hacerAmigos } from "../../content/blog/hacer-amigos-universidad";
import { planesBaratos } from "../../content/blog/planes-baratos-valencia";
import { erasmusValencia } from "../../content/blog/erasmus-valencia-conocer-gente";
import { bibliotecas } from "../../content/blog/bibliotecas-valencia-examenes";

// One post, both languages. Every post ships in Spanish and Valencian so each
// page can point at its twin with hreflang and neither index looks half empty.
export type PostText = {
 slug: string; title: string; description: string;
 // The search the piece is written for. Not printed; it keeps the plan honest.
 keyword: string;
 body: string;
};
export type Post = {
 id: string;
 date: string; updated?: string;
 cover: string; coverAlt: [string, string];
 tags: [string, string][];
 es: PostText; va: PostText;
};
export const AUTHOR = { name: "Equipo Entreclases", url: `${siteOrigin}/` };
// Newest first. Add a post by importing it and placing it in this list.
export const posts: Post[] = [hacerAmigos, planesBaratos, erasmusValencia, bibliotecas].sort((a, b) => b.date.localeCompare(a.date));

export function postText(post: Post, locale: Locale) { return post[locale]; }
export function postPath(locale: Locale, post: Post) { return `${routes[locale].blog}${post[locale].slug}/`; }
export function postUrl(locale: Locale, post: Post) { return siteOrigin + postPath(locale, post); }
export function postBySlug(locale: Locale, slug: string) { return posts.find((post) => post[locale].slug === slug); }
export function postBlocks(post: Post, locale: Locale) { return parseMarkdown(post[locale].body); }
export function postMinutes(post: Post, locale: Locale) { return readingMinutes(post[locale].body); }
export function postDate(value: string, locale: Locale) {
 return new Intl.DateTimeFormat(locale === "va" ? "ca-ES" : "es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long", year: "numeric" }).format(Date.parse(value));
}
export const blogTitle = (locale: Locale) => locale === "va" ? "Blog d’Entreclases — Vida universitària a València" : "Blog de Entreclases — Vida universitaria en Valencia";
export const blogDescription = (locale: Locale) => locale === "va"
 ? "Guies per a estudiants de les universitats de València: conéixer gent, plans barats, on estudiar i com sobreviure al primer curs. Escrit des del campus."
 : "Guías para estudiantes de las universidades de Valencia: conocer gente, planes baratos, dónde estudiar y cómo sobrevivir al primer curso. Escrito desde el campus.";
