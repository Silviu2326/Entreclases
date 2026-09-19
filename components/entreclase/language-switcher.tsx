"use client";
import { useSyncExternalStore } from "react";
import { actionSuffix } from "@/lib/auth/action-language";
import { createTranslator, localPath, type Locale, type RouteName } from "@/lib/i18n";
function subscribe(change: () => void) {
 window.addEventListener("hashchange",change); window.addEventListener("popstate",change);
 return () => { window.removeEventListener("hashchange",change); window.removeEventListener("popstate",change); };
}
function currentSuffix() { return window.location.search + window.location.hash; }
function emptySuffix() { return ""; }
export function LanguageSwitcher({ locale, route = "home" }: { locale: Locale; route?: RouteName }) {
 const tr = createTranslator(locale);
 const suffix = actionSuffix(useSyncExternalStore(subscribe,currentSuffix,emptySuffix),route);
 return <nav className="language-switcher" aria-label={tr("Idioma de Entreclase")}>
  <a href={localPath("es",route)+suffix} lang="es" hrefLang="es" aria-current={locale==="es" ? "page" : undefined}>Español</a>
  <span aria-hidden="true">/</span>
  <a href={localPath("va",route)+suffix} lang="ca-ES-valencia" hrefLang="ca-ES" aria-current={locale==="va" ? "page" : undefined}>Valencià</a>
 </nav>;
}
export function LaunchBar({locale,route="home"}:{locale:Locale;route?:RouteName}) {
 const tr=createTranslator(locale);
 return <div className="launch-bar"><div><a href={localPath(locale,"home")+"#valencia"}>{tr("Primero, Valencia.")}</a><LanguageSwitcher locale={locale} route={route}/></div></div>;
}
