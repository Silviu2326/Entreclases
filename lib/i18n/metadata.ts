import type { Metadata, Viewport } from "next";
import { localPath, type Locale, type RouteName } from "./index";
import { gameById, gamePath, languageIndex } from "../community/games/catalog";
import type { GameKind } from "../community/games/types";
import { projectPath, projectsPath, sectionById, type ProjectSection } from "../community/studio/sections";
export const siteOrigin = "https://www.entreclases.com";
export const siteTitle = (locale: Locale) => locale === "va" ? "Entreclases — La teua universitat. La teua gent. València." : "Entreclases — Tu universidad. Tu gente. Valencia.";
export function pageMetadata(locale: Locale, route: RouteName = "home"): Metadata {
 const title = siteTitle(locale);
 const description = locale === "va" ? "Entreclases comença a les universitats de València. Gent, plans i apunts del teu campus. Accés amb correu universitari. En espanyol i valencià." : "Entreclases empieza en las universidades de Valencia. Gente, planes y apuntes de tu campus. Acceso con correo universitario. En español y valenciano.";
 return { metadataBase: new URL(siteOrigin), title, description, applicationName: "Entreclases", icons: { icon: "/brand/entreclase-mark.png" },
   alternates: { canonical: localPath(locale,route), languages: { es: routesFor("es",route), "ca-ES": routesFor("va",route), "x-default": routesFor("es",route) } },
   openGraph: { title, description, locale: locale === "va" ? "ca_ES" : "es_ES", alternateLocale: locale === "va" ? "es_ES" : "ca_ES", type: "website", images: [{ url: "/images/campus.webp", width: 1448, height: 1086, alt: "Entreclases · Tu universidad, tu gente" }], url: localPath(locale,route) },
   // The landing and the roadmap are the public pages; everything else stays out of search.
   ...(route === "home" || route === "roadmap" ? {} : { robots: { index: false, follow: false }, referrer: "no-referrer" as const }),
 };
}
// A game page shares the app metadata but announces its own title and language alternates.
export function gameMetadata(locale: Locale, demo: boolean, id: GameKind): Metadata {
 const base = pageMetadata(locale, demo ? "demo" : "app"), game = gameById(id);
 if (!game) return base;
 const title = `${game.title[languageIndex(locale)]} — Entreclases`, path = gamePath(locale, demo, id);
 return { ...base, title, description: game.description[languageIndex(locale)],
   alternates: { canonical: path, languages: { es: siteOrigin+gamePath("es",demo,id), "ca-ES": siteOrigin+gamePath("va",demo,id), "x-default": siteOrigin+gamePath("es",demo,id) } },
   openGraph: { ...base.openGraph, title, description: game.description[languageIndex(locale)], url: path } };
}
// A project page announces its section. The project itself is not known when the
// site is built — it travels as ?id= — so the title belongs to the section.
export function projectMetadata(locale: Locale, demo: boolean, section?: ProjectSection): Metadata {
 const base = pageMetadata(locale, demo ? "demo" : "app"), entry = section ? sectionById(section) : undefined, index = languageIndex(locale);
 const title = `${entry ? entry.title[index] : locale === "va" ? "Projectes" : "Proyectos"} — Entreclases`;
 const description = entry ? entry.body[index] : locale === "va" ? "Idees que busquen mans. Junta carreres i acaba alguna cosa que pugues ensenyar." : "Ideas que buscan manos. Junta carreras y termina algo que puedas enseñar.";
 const place = (target: Locale) => entry ? projectPath(target,demo,entry.id) : projectsPath(target,demo);
 return { ...base, title, description,
   alternates: { canonical: place(locale), languages: { es: siteOrigin+place("es"), "ca-ES": siteOrigin+place("va"), "x-default": siteOrigin+place("es") } },
   openGraph: { ...base.openGraph, title, description, url: place(locale) } };
}
function routesFor(locale: Locale, route: RouteName) { return siteOrigin+localPath(locale,route); }
export const siteViewport: Viewport = { themeColor: "#f9f7f1", colorScheme: "light" };
