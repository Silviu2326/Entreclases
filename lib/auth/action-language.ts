import type { RouteName } from "../i18n/routes";

// Only the pending email action may follow a language switch.
export function actionSuffix(suffix: string, route: RouteName) {
 if (route !== "verify" && route !== "reset") return "";
 const source = new URL("https://entreclase.invalid/"+suffix);
 const query = new URLSearchParams(); const fragment = new URLSearchParams();
 for (const key of ["code","error"]) { const value=source.searchParams.get(key); if(value && value.length<=512) query.set(key,value); }
 const hash=new URLSearchParams(source.hash.slice(1));
 for (const key of ["token_hash","type","error"]) { const value=hash.get(key); if(value && value.length<=512) fragment.set(key,value); }
 return (query.size ? "?"+query : "")+(fragment.size ? "#"+fragment : "");
}
