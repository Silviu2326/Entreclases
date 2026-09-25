import type { Locale } from "../i18n/routes";
import { localPath } from "../i18n/routes";
import { normalizeStudy, type Study } from "../../supabase/functions/note-study/study";

export type { Card, Question, Study } from "../../supabase/functions/note-study/study";
export type StudyStatus = "working" | "ready" | "unreadable" | "too_long" | "failed";
export type NoteStudy = { status: StudyStatus; content: Study | null };

const statuses: readonly StudyStatus[] = ["working", "ready", "unreadable", "too_long", "failed"];
// Lo que llega de la base de datos o de la función se comprueba igual que en el servidor.
export function toNoteStudy(row: { status?: unknown; content?: unknown } | null | undefined): NoteStudy | null {
 if (!row) return null;
 const status = statuses.find(value => value === row.status);
 if (!status) return null;
 const content = status === "ready" ? normalizeStudy(row.content) : null;
 return status === "ready" && !content ? { status: "failed", content: null } : { status, content };
}

// El enlace abre el apunte en Campus con el test a la vista. Hace falta cuenta para verlo.
export function studyLink(locale: Locale, demo: boolean, noteId: string, origin: string) {
 const url = new URL(localPath(locale, demo ? "demo" : "app"), origin);
 url.searchParams.set("view", "campus");
 url.searchParams.set("nota", noteId);
 return url.toString();
}

export function challengeText(locale: Locale, title: string, right: number, total: number) {
 return locale === "va"
  ? `He fet ${right}/${total} en el test de «${title}» a Entreclases. A vore si tu el superes:`
  : `He sacado ${right}/${total} en el test de «${title}» en Entreclases. A ver si tú lo superas:`;
}

export function scoreLine(locale: Locale, right: number, total: number) {
 return locale === "va" ? `Has encertat ${right} de ${total}.` : `Has acertado ${right} de ${total}.`;
}

// En la demo no se llama a la IA: los apuntes de ejemplo traen su estudio hecho.
type Pair = readonly [string, string];
const pick = (locale: Locale, pair: Pair) => pair[locale === "va" ? 1 : 0];
const demoStudy = {
 summary: [
  ["Ejemplo de la demo: con una cuenta real, este resumen sale del PDF que abras.", "Exemple de la demo: amb un compte real, este resum ix del PDF que obris."],
  ["Primero se leen los apuntes y se sacan las ideas clave, en el orden en que aparecen.", "Primer es lligen els apunts i se n’extrauen les idees clau, en l’ordre en què apareixen."],
  ["Las tarjetas sirven para repasar conceptos sueltos en cinco minutos.", "Les targetes servixen per a repassar conceptes solts en cinc minuts."],
  ["El test comprueba si lo has entendido y explica cada respuesta.", "El test comprova si ho has entés i explica cada resposta."],
 ] as Pair[],
 cards: [
  [["¿De dónde sale el estudio?", "D’on ix l’estudi?"], ["Solo del PDF que comparte alguien de tu campus.", "Només del PDF que compartix algú del teu campus."]],
  [["¿Cuántas veces se prepara?", "Quantes vegades es prepara?"], ["Una por apunte. Después lo usa todo el que lo abra.", "Una per apunt. Després l’usa tothom que l’obri."]],
  [["¿Se guardan tus preguntas?", "Es guarden les teues preguntes?"], ["No. Se responden y se olvidan.", "No. Es responen i s’obliden."]],
  [["¿Y si la IA se equivoca?", "I si la IA s’equivoca?"], ["Mandan los apuntes. Contrasta siempre con el PDF.", "Manen els apunts. Contrasta sempre amb el PDF."]],
 ] as [Pair, Pair][],
 quiz: [
  { question: ["¿Quién puede ver el test de un apunte?", "Qui pot vore el test d’un apunt?"], options: [["Cualquiera en internet", "Qualsevol a internet"], ["Solo quien lo subió", "Només qui el va pujar"], ["Cualquier persona verificada de Entreclases", "Qualsevol persona verificada d’Entreclases"], ["Nadie", "Ningú"]], answer: 2, why: ["Los apuntes y su estudio solo se ven con una cuenta verificada.", "Els apunts i el seu estudi només es veuen amb un compte verificat."] },
  { question: ["¿Qué pasa con un PDF escaneado?", "Què passa amb un PDF escanejat?"], options: [["Se lee igual", "Es llig igual"], ["Todavía no se puede estudiar con IA", "Encara no es pot estudiar amb IA"], ["Se borra", "S’esborra"], ["Se traduce", "Es traduïx"]], answer: 1, why: ["De momento hace falta un PDF con texto.", "De moment cal un PDF amb text."] },
  { question: ["¿Cuántas veces se genera el estudio de un apunte?", "Quantes vegades es genera l’estudi d’un apunt?"], options: [["Una vez por persona", "Una vegada per persona"], ["Cada día", "Cada dia"], ["Una vez por apunte", "Una vegada per apunt"], ["Nunca", "Mai"]], answer: 2, why: ["Se prepara una vez y queda para todos.", "Es prepara una vegada i queda per a tots."] },
  { question: ["¿Qué hace «Reta a tu clase»?", "Què fa «Repta la teua classe»?"], options: [["Publica tu nota en el perfil", "Publica la teua nota en el perfil"], ["Comparte un enlace al test", "Compartix un enllaç al test"], ["Envía un correo al profesor", "Envia un correu al professor"], ["Nada", "Res"]], answer: 1, why: ["Genera un enlace para mandarlo al grupo de clase.", "Genera un enllaç per a enviar-lo al grup de classe."] },
  { question: ["Si la IA y los apuntes no coinciden, ¿qué manda?", "Si la IA i els apunts no coincidixen, què mana?"], options: [["La IA", "La IA"], ["Los apuntes", "Els apunts"], ["El test", "El test"], ["Lo más corto", "El més curt"]], answer: 1, why: ["La IA puede equivocarse; los apuntes son la fuente.", "La IA pot equivocar-se; els apunts són la font."] },
 ] as { question: Pair; options: Pair[]; answer: number; why: Pair }[],
};

export function demoNoteStudy(locale: Locale): NoteStudy {
 return { status: "ready", content: {
  language: locale === "va" ? "va" : "es",
  summary: demoStudy.summary.map(item => pick(locale, item)),
  cards: demoStudy.cards.map(([front, back]) => ({ front: pick(locale, front), back: pick(locale, back) })),
  quiz: demoStudy.quiz.map(item => ({ question: pick(locale, item.question), options: item.options.map(option => pick(locale, option)), answer: item.answer, why: pick(locale, item.why) })),
 } };
}

export function demoAnswer(locale: Locale) {
 return locale === "va"
  ? "En la demo no es consulta la IA. Amb un compte real, la resposta ix només del text d’este PDF."
  : "En la demo no se consulta la IA. Con una cuenta real, la respuesta sale solo del texto de este PDF.";
}
