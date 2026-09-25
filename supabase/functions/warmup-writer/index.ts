// Propone rondas de calentamiento nuevas para el «juego del día». Las deja como
// pendientes: nada llega a la aplicación hasta que el equipo lo aprueba en el
// backoffice. Se despliega con --no-verify-jwt y la llama una tarea programada
// con su propio secreto, igual que waitlist-mailer.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { normalizeWarmup, warmupGames, warmupInstructions, warmupSchema, type WarmupGame } from "./warmups.ts";

const env = (name: string) => Deno.env.get(name) ?? "";
const SECRET = env("WARMUP_CRON_SECRET");
const OPENAI_KEY = env("OPENAI_API_KEY");
const OPENAI_URL = (env("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
const MODEL = env("WARMUP_MODEL") || "gpt-6-luna";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

async function propose(game: WarmupGame, count: number) {
 const response = await fetch(`${OPENAI_URL}/responses`, {
  method: "POST",
  headers: { authorization: `Bearer ${OPENAI_KEY}`, "content-type": "application/json" },
  body: JSON.stringify({
   model: MODEL, store: false, max_output_tokens: 4000,
   input: [{ role: "system", content: warmupInstructions(game, count) }, { role: "user", content: `Escribe ${count} rondas.` }],
   text: { format: { type: "json_schema", name: "rondas", schema: warmupSchema(game), strict: true } },
  }),
 });
 if (!response.ok) throw new Error(`openai ${response.status}: ${(await response.text()).slice(0, 300)}`);
 const body = await response.json() as { status?: string; output?: { type: string; content?: { type: string; text?: string }[] }[] };
 if (body.status === "incomplete") throw new Error("openai incomplete");
 const text = (body.output ?? []).filter(item => item.type === "message").flatMap(item => item.content ?? []).filter(part => part.type === "output_text").map(part => part.text ?? "").join("");
 const items = (JSON.parse(text) as { items?: unknown[] }).items ?? [];
 return items.map(item => normalizeWarmup(game, item)).filter(Boolean);
}

Deno.serve(async (request) => {
 if (request.method !== "POST") return new Response("Not found", { status: 404 });
 if (!SECRET || request.headers.get("x-warmup-secret") !== SECRET) return new Response("Forbidden", { status: 403 });
 if (!OPENAI_KEY) return Response.json({ error: "OPENAI_API_KEY sin configurar" }, { status: 500 });
 const url = new URL(request.url);
 const count = Math.min(5, Math.max(1, Number(url.searchParams.get("rondas")) || 3));
 const asked = url.searchParams.get("juego");
 const games = asked ? warmupGames.filter(game => game === asked) : warmupGames;

 const added: Record<string, number> = {}, failed: string[] = [];
 for (const game of games) {
  try {
   added[game] = 0;
   for (const content of await propose(game, count)) {
    const { data, error } = await db.rpc("universe_warmup_add", { p_game: game, p_content: content, p_model: MODEL });
    if (error) throw error;
    if (data === true) added[game] += 1;
   }
  } catch (error) { failed.push(`${game}: ${error instanceof Error ? error.message : String(error)}`); }
 }
 return Response.json({ added, failed });
});
