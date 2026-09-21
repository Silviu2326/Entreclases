// Folds the mailer's modules into one file for the Supabase dashboard editor,
// which takes a single index.ts. The split sources stay the truth; this is
// what you paste when there is no CLI at hand.
import { readFile, writeFile, mkdir } from "node:fs/promises";
const dir = new URL("../supabase/functions/waitlist-mailer/", import.meta.url);
const read = async (name) => (await readFile(new URL(name, dir), "utf8"))
 .replace(/^import type .*\n/gm, "").replace(/^import \{[^}]*\} from "\.\/.*\n/gm, "");
const parts = ["types.ts", "emails.es.ts", "emails.va.ts", "render.ts", "index.ts"];
let out = `// Generado por scripts/bundle-waitlist-mailer.mjs — no editar a mano.\n// Fuente: supabase/functions/waitlist-mailer/\n`;
for (const name of parts) {
 let code = await read(name);
 // Every module exports; in one file only the names used across modules matter.
 code = code.replace(/^export (const|function|type) /gm, "$1 ");
 // The two languages export the same names: prefix them so both can coexist.
 if (name === "emails.es.ts") code = code.replace(/const letters/, "const lettersEs");
 if (name === "emails.va.ts") code = code.replace(/const letters/, "const lettersVa");
 if (name === "render.ts") code = code.replace("const sequences: Record<Language, Letter[]> = { es, va };", "const sequences: Record<Language, Letter[]> = { es: lettersEs, va: lettersVa };");
 out += `\n// ---- ${name} ----\n${code}`;
}
// Deno's own import stays at the top, where the runtime expects it.
const supabase = out.match(/^import \{ createClient \}.*\n/m)[0];
out = supabase + out.replace(supabase, "");
await mkdir(new URL("../output/", import.meta.url), { recursive: true });
await writeFile(new URL("../output/waitlist-mailer.index.ts", import.meta.url), out);
console.log(`output/waitlist-mailer.index.ts: ${out.split("\n").length} líneas`);
