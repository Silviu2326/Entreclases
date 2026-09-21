import type { Language, Letter } from "./types.ts";
import { letters as es } from "./emails.es.ts";
import { letters as va } from "./emails.va.ts";

const sequences: Record<Language, Letter[]> = { es, va };
const paths: Record<Language, string> = { es: "/", va: "/va/" };

// The seven mornings introduce the platform, so they do not depend on the
// calendar: whoever joins reads the same ones, today or months from now.
export function letterFor(language: Language, step: number): Letter | null {
 return sequences[language][step] ?? null;
}

const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escape = (value: string) => value.replace(/[&<>"]/g, (character) => entities[character]);

// Plain text is the message; the HTML part only keeps the line breaks and adds
// the one link the law and every inbox expect.
// `away` is the function's own address unless a rewrite puts it on the domain:
// an unsubscribe link has to answer without the static export in the middle.
export function render(letter: Letter, language: Language, origin: string, unsubscribeBase: string, token: string) {
 const site = origin + paths[language];
 const away = `${unsubscribeBase}?baja=${token}&l=${language}`;
 const body = letter.body.replaceAll("{{site}}", site);
 const goodbye = language === "va"
  ? "Has rebut això perquè vas deixar el teu correu a entreclases.com. Donar-se de baixa:"
  : "Recibes esto porque dejaste tu correo en entreclases.com. Darte de baja:";
 const text = `${body}\n\n—\n${goodbye}\n${away}\n`;
 const html = `<!doctype html><html lang="${language === "va" ? "ca-ES-valencia" : "es"}"><meta charset="utf-8">`
  + `<div style="font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2a172e;max-width:34em">`
  + body.split("\n\n").map((paragraph) => `<p>${escape(paragraph).replaceAll("\n", "<br>")}</p>`).join("")
  + `<hr style="border:none;border-top:1px solid #d6cfbe;margin:28px 0">`
  + `<p style="font-size:13px;color:#6d6472">${escape(goodbye)} <a href="${escape(away)}" style="color:#6d6472">${escape(away)}</a></p>`
  + `</div></html>`;
 return { subject: letter.subject, text, html, away };
}
