// Sends whatever the queue says is owed, and answers the unsubscribe link.
// Deployed with --no-verify-jwt: the POST checks its own shared secret so the
// GET can be opened from an inbox, where nobody carries a token.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { letterFor, render } from "./render.ts";
import type { Language } from "./types.ts";

const env = (name: string) => Deno.env.get(name) ?? "";
const ORIGIN = env("WAITLIST_SITE_ORIGIN") || "https://www.entreclases.com";
const FROM = env("WAITLIST_FROM") || "Entreclases <avisos@entreclases.com>";
const REPLY_TO = env("WAITLIST_REPLY_TO") || "hola@entreclases.com";
const SECRET = env("WAITLIST_CRON_SECRET");
const RESEND = env("RESEND_API_KEY");

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

type Due = { queue_id: number; address: string; language: Language; step: number; token: string; alone: boolean };

async function send(due: Due, unsubscribeBase: string) {
 const letter = letterFor(due.language, due.step, due.alone);
 if (!letter) return "sin carta para este paso";
 const mail = render(letter, due.language, ORIGIN, unsubscribeBase, due.token);
 const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { authorization: `Bearer ${RESEND}`, "content-type": "application/json" },
  body: JSON.stringify({
   from: FROM, to: [due.address], reply_to: REPLY_TO,
   subject: mail.subject, text: mail.text, html: mail.html,
   // Every inbox looks for these before it decides you are not spam.
   headers: { "List-Unsubscribe": `<${mail.away}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  }),
 });
 if (response.ok) return null;
 return `resend ${response.status}: ${(await response.text()).slice(0, 300)}`;
}

function page(language: string, done: boolean) {
 const va = language === "va";
 const title = done
  ? (va ? "Fet. No t’escrivim més." : "Hecho. No te escribimos más.")
  : (va ? "Eixe enllaç ja no val." : "Ese enlace ya no vale.");
 const note = done
  ? (va ? "Has eixit de la llista d’Entreclases. Si algun dia canvies d’idea, ja saps on estem." : "Has salido de la lista de Entreclases. Si algún día cambias de idea, ya sabes dónde estamos.")
  : (va ? "Potser ja t’havies donat de baixa. Si continues rebent correus, escriu-nos a hola@entreclases.com." : "Puede que ya te hubieras dado de baja. Si sigues recibiendo correos, escríbenos a hola@entreclases.com.");
 return new Response(
  `<!doctype html><html lang="${va ? "ca-ES-valencia" : "es"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">`
  + `<title>${title}</title><body style="font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f9f7f1;color:#2a172e;margin:0">`
  + `<main style="max-width:32em;margin:auto;padding:14vh 22px"><h1 style="font-size:30px;letter-spacing:-.04em;line-height:1.1">${title}</h1>`
  + `<p>${note}</p><p><a href="${ORIGIN}" style="color:#2a172e">entreclases.com</a></p></main></html>`,
  { status: done ? 200 : 404, headers: { "content-type": "text/html; charset=utf-8" } },
 );
}

Deno.serve(async (request) => {
 const url = new URL(request.url);
 const token = url.searchParams.get("baja");

 // One-click unsubscribe: inboxes send POST here, people arrive with GET.
 if (token) {
  const { data } = await db.rpc("universe_waitlist_unsubscribe", { token });
  return page(url.searchParams.get("l") ?? "es", data === true);
 }

 if (request.method !== "POST") return new Response("Not found", { status: 404 });
 if (!SECRET || request.headers.get("x-waitlist-secret") !== SECRET) return new Response("Forbidden", { status: 403 });
 if (!RESEND) return Response.json({ error: "RESEND_API_KEY sin configurar" }, { status: 500 });

 const { data, error } = await db.rpc("universe_waitlist_due", { batch: 40 });
 if (error) return Response.json({ error: error.message }, { status: 500 });

 const unsubscribeBase = env("WAITLIST_UNSUBSCRIBE_URL") || url.origin + url.pathname;
 let sent = 0;
 const failed: string[] = [];
 for (const due of (data ?? []) as Due[]) {
  const failure = await send(due, unsubscribeBase);
  await db.rpc("universe_waitlist_sent", { queue_id: due.queue_id, failure });
  if (failure) failed.push(`#${due.queue_id} ${failure}`); else sent += 1;
 }
 return Response.json({ sent, failed });
});
