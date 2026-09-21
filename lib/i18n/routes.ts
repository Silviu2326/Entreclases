export type Locale = "es" | "va";
export const routes = {
 es: { legal: "/aviso-legal/", cookies: "/cookies/", community: "/normas-comunidad/", rights: "/derechos-datos/", reports: "/denunciar/", privacy: "/privacidad/", terms: "/condiciones/", home: "/", register: "/registro/", login: "/login/", verify: "/verificar/", recovery: "/recuperar-contrasena/", reset: "/nueva-contrasena/", account: "/mi-cuenta/", app: "/app/", demo: "/demo/", roadmap: "/roadmap/" },
 va: { legal: "/va/avis-legal/", cookies: "/va/cookies/", community: "/va/normes-comunitat/", rights: "/va/drets-dades/", reports: "/va/denunciar/", privacy: "/va/privacitat/", terms: "/va/condicions/", home: "/va/", register: "/va/registre/", login: "/va/iniciar-sessio/", verify: "/va/verificar/", recovery: "/va/recuperar-contrasenya/", reset: "/va/nova-contrasenya/", account: "/va/el-meu-compte/", app: "/va/app/", demo: "/va/demo/", roadmap: "/va/full-de-ruta/" },
} as const;
export type RouteName = keyof typeof routes.es;
export function localPath(locale: Locale, name: RouteName) { return routes[locale][name]; }
export function localHref(locale: Locale, href: string) {
 const index = href.search(/[?#]/);
 const path = index < 0 ? href : href.slice(0,index);
 const suffix = index < 0 ? "" : href.slice(index);
 const name = (Object.keys(routes.es) as RouteName[]).find((key) => routes.es[key] === path);
 return name ? routes[locale][name] + suffix : href;
}
