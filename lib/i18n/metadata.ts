import type { Metadata, Viewport } from "next";
import { localPath, type Locale, type RouteName } from "./index";
export const siteOrigin = "https://universe-landing.shironecocrazy.chatgpt.site";
export function pageMetadata(locale: Locale, route: RouteName = "home"): Metadata {
 const title = locale === "va" ? "Entreclase — La teua universitat. La teua gent. València." : "Entreclase — Tu universidad. Tu gente. Valencia.";
 const description = locale === "va" ? "Entreclase comença a les universitats de València. Gent, plans i apunts del teu campus. Accés amb correu universitari. En espanyol i valencià." : "Entreclase empieza en las universidades de Valencia. Gente, planes y apuntes de tu campus. Acceso con correo universitario. En español y valenciano.";
 return { metadataBase: new URL(siteOrigin), title, description, applicationName: "Entreclase", icons: { icon: "/brand/entreclase-mark.png" },
   alternates: { canonical: localPath(locale,route), languages: { es: routesFor("es",route), "ca-ES": routesFor("va",route), "x-default": routesFor("es",route) } },
   openGraph: { title, description, locale: locale === "va" ? "ca_ES" : "es_ES", alternateLocale: locale === "va" ? "es_ES" : "ca_ES", type: "website", url: localPath(locale,route) },
   ...(route === "home" ? {} : { robots: { index: false, follow: false }, referrer: "no-referrer" as const }),
 };
}
function routesFor(locale: Locale, route: RouteName) { return siteOrigin+localPath(locale,route); }
export const siteViewport: Viewport = { themeColor: "#f9f7f1", colorScheme: "light" };
