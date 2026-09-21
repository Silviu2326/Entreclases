import type { RouteName } from "../i18n/routes";

// Only the pending email action may follow a language switch.
export function actionSuffix(suffix: string, route: RouteName) {
 if (route === "register") {
  const hash = new URL("https://entreclase.invalid/" + suffix).hash;
  const source = new URLSearchParams(hash.slice(1));
  const token = source.get("plus-one");
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return "";
  const allowed = new URLSearchParams({ "plus-one": token });
  if (source.get("preview") === "1") allowed.set("preview", "1");
  return "#" + allowed;
 }
 if (route !== "verify" && route !== "reset") return "";
 const source = new URL("https://entreclase.invalid/"+suffix);
 const query = new URLSearchParams(); const fragment = new URLSearchParams();
 for (const key of ["code","error"]) { const value=source.searchParams.get(key); if(value && value.length<=512) query.set(key,value); }
 const hash=new URLSearchParams(source.hash.slice(1));
 for (const key of ["token_hash","type","error"]) { const value=hash.get(key); if(value && value.length<=512) fragment.set(key,value); }
 return (query.size ? "?"+query : "")+(fragment.size ? "#"+fragment : "");
}
