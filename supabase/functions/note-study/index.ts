// Estudiar con un apunte. Dos acciones:
//  - prepare: lee el PDF una vez, pide a la IA resumen, tarjetas y test, y lo guarda
//    para todo el que abra ese apunte.
//  - ask: responde una duda con el texto de ese apunte, sin guardar la pregunta.
// Se despliega con verificación de JWT: solo llega aquí quien tiene sesión, y los
// cupos y la pertenencia los comprueba PostgreSQL con esa misma sesión.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf@1";
import { askInstructions, normalizeStudy, sourceVerdict, studyInstructions, studySchema, tidySource } from "./study.ts";

const env = (name: string) => Deno.env.get(name) ?? "";
const OPENAI_KEY = env("OPENAI_API_KEY");
// Con residencia de datos en la UE: https://eu.api.openai.com/v1
const OPENAI_URL = (env("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
const MODEL = env("NOTE_STUDY_MODEL") || "gpt-6-luna";
const ORIGINS = (env("NOTE_STUDY_ORIGINS") || "https://www.entreclases.com,http://localhost:3000").split(",").map(origin => origin.trim());
const SUPABASE_URL = env("SUPABASE_URL");
const service = createClient(SUPABASE_URL, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
type Client = typeof service;

function cors(request: Request) {
 const origin = request.headers.get("origin") ?? "";
 return {
  "access-control-allow-origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  vary: "origin",
 };
}

// Los errores que conoce la pantalla llevan un código; el resto sale como genérico.
const known = ["STUDY_NOT_MEMBER", "STUDY_NOT_FOUND", "STUDY_NOT_READY", "STUDY_DAILY_LIMIT"];
function failure(error: unknown) {
 const message = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error);
 return known.find(code => message.includes(code)) ?? "STUDY_UNAVAILABLE";
}

async function respond(input: unknown[], format?: Record<string, unknown>, maxOutput = 6000) {
 const response = await fetch(`${OPENAI_URL}/responses`, {
  method: "POST",
  headers: { authorization: `Bearer ${OPENAI_KEY}`, "content-type": "application/json" },
  body: JSON.stringify({ model: MODEL, input, max_output_tokens: maxOutput, store: false, ...(format ? { text: { format } } : {}) }),
 });
 if (!response.ok) throw new Error(`openai ${response.status}: ${(await response.text()).slice(0, 300)}`);
 const body = await response.json() as { status?: string; output?: { type: string; content?: { type: string; text?: string }[] }[] };
 if (body.status === "incomplete") throw new Error("openai incomplete");
 const parts = (body.output ?? []).filter(item => item.type === "message").flatMap(item => item.content ?? []);
 if (parts.some(part => part.type === "refusal")) throw new Error("openai refusal");
 return parts.filter(part => part.type === "output_text").map(part => part.text ?? "").join("");
}

async function prepare(user: Client, note: string) {
 const { data: claim, error } = await user.rpc("universe_note_study_request", { p_note: note });
 if (error) throw error;
 const state = claim as { status: string; file_path?: string; title?: string; subject?: string };
 if (state.status !== "claimed") return { status: state.status };

 const save = (status: string, content: unknown = null, language: string | null = null, pages: number | null = null, source: string | null = null) =>
  service.rpc("universe_note_study_save", { p_note: note, p_status: status, p_content: content, p_language: language, p_model: content ? MODEL : null, p_pages: pages, p_source: source });
 try {
  const file = await service.storage.from("universe-notes").download(state.file_path!);
  if (file.error || !file.data) throw file.error ?? new Error("sin archivo");
  const pdf = await getDocumentProxy(new Uint8Array(await file.data.arrayBuffer()));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const source = tidySource(Array.isArray(text) ? text : [text]);
  const verdict = sourceVerdict(totalPages, source);
  if (verdict !== "ok") { await save(verdict, null, null, totalPages); return { status: verdict }; }

  const raw = await respond([
   { role: "system", content: studyInstructions },
   { role: "user", content: `Asignatura: ${state.subject}\nTítulo: ${state.title}\n\nApuntes:\n${source}` },
  ], { type: "json_schema", name: "estudio", schema: studySchema, strict: true });
  const study = normalizeStudy(JSON.parse(raw));
  if (!study) throw new Error("respuesta incompleta");
  await save("ready", study, study.language, totalPages, source);
  return { status: "ready", content: study };
 } catch (problem) {
  console.error("note-study prepare", note, problem);
  await save("failed");
  return { status: "failed" };
 }
}

async function ask(user: Client, note: string, question: string) {
 const { error } = await user.rpc("universe_note_ask_request", { p_note: note });
 if (error) throw error;
 const { data: source } = await service.rpc("universe_note_study_source", { p_note: note });
 if (!source) throw new Error("STUDY_NOT_READY");
 const answer = await respond([
  { role: "system", content: `${askInstructions}\n\nApuntes:\n${source}` },
  { role: "user", content: question },
 ], undefined, 700);
 return { answer: answer.trim() };
}

Deno.serve(async (request) => {
 const headers = cors(request);
 if (request.method === "OPTIONS") return new Response(null, { headers });
 if (request.method !== "POST") return new Response("Not found", { status: 404, headers });
 const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
 if (!OPENAI_KEY) return reply({ error: "STUDY_UNAVAILABLE" }, 503);

 let body: { action?: string; note?: string; question?: string };
 try { body = await request.json(); } catch { return reply({ error: "STUDY_BAD_REQUEST" }, 400); }
 const note = String(body.note ?? "");
 if (!/^[0-9a-f-]{36}$/i.test(note)) return reply({ error: "STUDY_BAD_REQUEST" }, 400);

 // Las comprobaciones de la base de datos se hacen como quien llama, no como servicio.
 const user = createClient(SUPABASE_URL, env("SUPABASE_ANON_KEY"), {
  auth: { persistSession: false },
  global: { headers: { authorization: request.headers.get("authorization") ?? "" } },
 });
 try {
  if (body.action === "prepare") return reply(await prepare(user, note));
  if (body.action === "ask") {
   const question = String(body.question ?? "").replace(/\s+/g, " ").trim();
   if (question.length < 3 || question.length > 400) return reply({ error: "STUDY_BAD_REQUEST" }, 400);
   return reply(await ask(user, note, question));
  }
  return reply({ error: "STUDY_BAD_REQUEST" }, 400);
 } catch (error) {
  const code = failure(error);
  if (code === "STUDY_UNAVAILABLE") console.error("note-study", body.action, note, error);
  return reply({ error: code }, code === "STUDY_DAILY_LIMIT" ? 429 : code === "STUDY_UNAVAILABLE" ? 502 : 403);
 }
});
