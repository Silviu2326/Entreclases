import { localPath, type Locale } from "../../i18n/routes";

/**
 * Every project has an address of its own. The sections are a closed list, so
 * they become real pages in the static export; the project travels as `?id=`,
 * because its identifier is only born when somebody creates it and there is
 * nothing to generate at build time.
 */
export type ProjectSection = "nuevo" | "ficha" | "editar" | "solicitudes" | "equipo" | "archivos" | "resultado";
export type ProjectRoute = "hub" | ProjectSection;
/** Who gets past the door. The page checks it again with the loaded project. */
export type SectionAccess = "everyone" | "owner" | "team";
export type SectionEntry = {
  id: ProjectSection;
  slug: readonly [string, string];
  title: readonly [string, string];
  body: readonly [string, string];
  access: SectionAccess;
  /** Every section but "nuevo" is about one project and needs `?id=` to mean anything. */
  project: boolean;
};

export const projectSections: readonly SectionEntry[] = [
  { id: "nuevo", slug: ["nuevo", "nou"], access: "everyone", project: false,
    title: ["Crear un proyecto", "Crear un projecte"],
    body: ["Cuenta qué queréis conseguir y qué manos te faltan.", "Conta què voleu aconseguir i quines mans et falten."] },
  { id: "ficha", slug: ["ficha", "fitxa"], access: "everyone", project: true,
    title: ["El proyecto", "El projecte"],
    body: ["Qué es, quién lo impulsa y qué puestos quedan libres.", "Què és, qui l’impulsa i quins llocs queden lliures."] },
  { id: "editar", slug: ["editar", "editar"], access: "owner", project: true,
    title: ["Editar el proyecto", "Editar el projecte"],
    body: ["Cambia la ficha, los puestos y los hitos.", "Canvia la fitxa, els llocs i les fites."] },
  { id: "solicitudes", slug: ["solicitudes", "solicituds"], access: "owner", project: true,
    title: ["Solicitudes recibidas", "Sol·licituds rebudes"],
    body: ["Quién quiere entrar, qué aporta y cuándo puede.", "Qui vol entrar, què aporta i quan pot."] },
  { id: "equipo", slug: ["equipo", "equip"], access: "team", project: true,
    title: ["El equipo", "L’equip"],
    body: ["Quién está dentro y la conversación privada del proyecto.", "Qui està dins i la conversa privada del projecte."] },
  { id: "archivos", slug: ["archivos", "arxius"], access: "team", project: true,
    title: ["Archivos del equipo", "Arxius de l’equip"],
    body: ["Lo que os pasáis para trabajar. Solo lo ve el equipo.", "El que vos passeu per a treballar. Només ho veu l’equip."] },
  { id: "resultado", slug: ["resultado", "resultat"], access: "everyone", project: true,
    title: ["El resultado", "El resultat"],
    body: ["Lo que habéis conseguido y quién lo firma.", "El que heu aconseguit i qui ho firma."] },
];

export const languageIndex = (locale: Locale) => locale === "va" ? 1 : 0;
export const sectionById = (id: string) => projectSections.find(section => section.id === id);
export const sectionBySlug = (locale: Locale, slug: string) => projectSections.find(section => section.slug[languageIndex(locale)] === slug);

/** The hub: /app/proyectos/ and its Valencian and demo variants. */
export function projectsPath(locale: Locale, demo: boolean) {
  return `${localPath(locale, demo ? "demo" : "app")}${locale === "va" ? "projectes" : "proyectos"}/`;
}

/** One section of one project: /app/proyectos/solicitudes/?id=<uuid>. */
export function projectPath(locale: Locale, demo: boolean, section: ProjectSection, id?: string) {
  const entry = sectionById(section);
  if (!entry) return projectsPath(locale, demo);
  return `${projectsPath(locale, demo)}${entry.slug[languageIndex(locale)]}/${id ? `?id=${encodeURIComponent(id)}` : ""}`;
}
