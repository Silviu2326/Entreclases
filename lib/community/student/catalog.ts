import { localPath, type Locale } from "../../i18n/routes";

// Herramientas de la sección Estudiante. Cada una es una microaplicación con
// su propia pantalla y su propio estado; ninguna necesita que haya más gente.
// Desactivar una aquí la quita del hub y deja de cargarse su pantalla.
export type ToolKind = "grades" | "teamwork" | "calendar" | "libraries" | "notes" | "exam";
export type ToolGroup = "study" | "organize" | "campus";
export type ToolEntry = {
  id: ToolKind;
  enabled: boolean;
  /** Llama a la IA (necesita la función `study-tutor` en cuentas reales). */
  ai: boolean;
  group: ToolGroup;
  slug: readonly [string, string];
  title: readonly [string, string];
  description: readonly [string, string];
  /** Lo que se le pide al usuario para empezar, en una frase. */
  effort: readonly [string, string];
};

export const toolCatalog: readonly ToolEntry[] = [
  { id: "notes", enabled: true, ai: true, group: "study", slug: ["tutor-de-apuntes", "tutor-d-apunts"], title: ["Tutor de apuntes", "Tutor d’apunts"], description: ["Sube tus apuntes y pídele que te lo explique, lo resuma o te haga tarjetas.", "Puja els teus apunts i demana-li que t’ho explique, ho resumisca o et faça targetes."], effort: ["Un PDF, una foto o texto pegado", "Un PDF, una foto o text enganxat"] },
  { id: "exam", enabled: true, ai: true, group: "study", slug: ["examiname", "examina-m"], title: ["Examíname", "Examina’m"], description: ["Un test a partir de tus apuntes. Te corrige y te dice qué temas flojean.", "Un test a partir dels teus apunts. Et corregix i et diu quins temes fluixegen."], effort: ["Elige cuántas preguntas", "Tria quantes preguntes"] },
  { id: "grades", enabled: true, ai: false, group: "organize", slug: ["calculadora-de-notas", "calculadora-de-notes"], title: ["¿Qué necesito en el final?", "Què necessite en el final?"], description: ["Mete los porcentajes y las notas que ya tienes. Te dice lo que te falta.", "Fica els percentatges i les notes que ja tens. Et diu el que et falta."], effort: ["Dos minutos", "Dos minuts"] },
  { id: "calendar", enabled: true, ai: false, group: "organize", slug: ["mi-semana", "la-meua-setmana"], title: ["Mi semana", "La meua setmana"], description: ["Clases, entregas y exámenes en un solo sitio. Lo que toca hoy, arriba.", "Classes, entregues i exàmens en un sol lloc. El que toca hui, dalt."], effort: ["Añade tus asignaturas", "Afig les teues assignatures"] },
  { id: "teamwork", enabled: true, ai: false, group: "organize", slug: ["trabajos-en-grupo", "treballs-en-grup"], title: ["Trabajos en grupo", "Treballs en grup"], description: ["Quién hace qué y para cuándo. Para que el trabajo no lo acabe haciendo uno.", "Qui fa què i per a quan. Perquè el treball no l’acabe fent un."], effort: ["Un trabajo, sus tareas, su gente", "Un treball, les seues tasques, la seua gent"] },
  { id: "libraries", enabled: true, ai: false, group: "campus", slug: ["donde-estudio", "on-estudie"], title: ["¿Dónde estudio?", "On estudie?"], description: ["Bibliotecas y salas de estudio de Valencia: horarios, salas de grupo y enlaces oficiales.", "Biblioteques i sales d’estudi de València: horaris, sales de grup i enllaços oficials."], effort: ["Elige campus", "Tria campus"] },
];

export const enabledTools = toolCatalog.filter(tool => tool.enabled);
export const languageIndex = (locale: Locale) => locale === "va" ? 1 : 0;
export function toolById(id: string) { return enabledTools.find(tool => tool.id === id); }
export function toolBySlug(locale: Locale, slug: string) { return enabledTools.find(tool => tool.slug[languageIndex(locale)] === slug); }

// Las herramientas viven dentro de la vista `student`: /app/?view=student&tool=<slug>.
export function toolPath(locale: Locale, demo: boolean, id?: ToolKind) {
  const base = `${localPath(locale, demo ? "demo" : "app")}?view=student`;
  const tool = id ? toolCatalog.find(entry => entry.id === id) : undefined;
  return tool ? `${base}&tool=${tool.slug[languageIndex(locale)]}` : base;
}

export const toolGroups: ReadonlyArray<{ id: ToolGroup; title: readonly [string, string]; description: readonly [string, string] }> = [
  { id: "study", title: ["Estudiar", "Estudiar"], description: ["Tus apuntes, trabajando para ti.", "Els teus apunts, treballant per a tu."] },
  { id: "organize", title: ["Organizarte", "Organitzar-te"], description: ["Notas, fechas y trabajos sin hojas sueltas.", "Notes, dates i treballs sense fulls solts."] },
  { id: "campus", title: ["Moverte por Valencia", "Moure’t per València"], description: ["Lo que hay abierto y dónde.", "El que hi ha obert i on."] },
];
