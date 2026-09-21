import { minAnonymousAudience, type Audience, type AudienceKind, type GameWorld, type GamePerson } from "./types";

/** One choice in the audience picker every game shares. */
export type AudienceChoice = {
  kind: AudienceKind;
  ref?: string;
  label: string;
  detail: string;
  /** People it reaches, not counting me. */
  reach: number;
  /** Set when the choice cannot be used right now. */
  blocked?: string;
};

const sameCourse = (a: GamePerson, b: GamePerson) => a.degree === b.degree && a.year === b.year;

export function inAudience(person: GamePerson, audience: Audience, world: GameWorld): boolean {
  const me = world.me;
  if (person.id === me.id) return false;
  switch (audience.kind) {
    case "campus": return true;
    case "site": return person.campus === me.campus;
    case "degree": return person.degree === me.degree;
    case "course": return sameCourse(person, me);
    case "group": return !!audience.ref && person.groups.includes(audience.ref);
    case "contacts": return person.contact;
    case "person": return person.id === audience.ref;
  }
}

export const audienceReach = (audience: Audience, world: GameWorld) => world.people.filter(person => inAudience(person, audience, world)).length;

export function audienceLabel(audience: Audience, world: GameWorld): string {
  const t = world.t;
  switch (audience.kind) {
    case "campus": return t("Todo el campus", "Tot el campus");
    case "site": return world.me.campus;
    case "degree": return world.me.degree;
    case "course": return `${world.me.degree} · ${world.me.year}º`;
    case "group": return world.groups.find(group => group.id === audience.ref)?.name ?? t("Un grupo", "Un grup");
    case "contacts": return t("Mis contactos", "Els meus contactes");
    case "person": return world.people.find(person => person.id === audience.ref)?.name ?? t("Una persona", "Una persona");
  }
}

/**
 * The audience choices open to this person, in the order the picker shows them.
 * `kinds` narrows the list to the ones a game accepts; `anonymous` blocks the
 * collective audiences that are too small to hide an author.
 */
export function audienceChoices(world: GameWorld, kinds: AudienceKind[], anonymous = false): AudienceChoice[] {
  const t = world.t, out: AudienceChoice[] = [];
  const add = (kind: AudienceKind, ref: string | undefined, label: string, detail: string) => {
    const reach = audienceReach({ kind, ref }, world);
    const small = anonymous && kind !== "person" && reach < minAnonymousAudience;
    out.push({ kind, ref, label, detail, reach, blocked: small ? t(`Hacen falta ${minAnonymousAudience} personas para preguntar sin dar tu nombre.`, `Calen ${minAnonymousAudience} persones per a preguntar sense donar el teu nom.`) : undefined });
  };
  for (const kind of kinds) {
    if (kind === "campus") add("campus", undefined, t("Todo el campus", "Tot el campus"), t("Cualquier cuenta universitaria verificada.", "Qualsevol compte universitari verificat."));
    if (kind === "site") add("site", undefined, world.me.campus, t("Quien estudia en tu sede.", "Qui estudia a la teua seu."));
    if (kind === "degree") add("degree", undefined, world.me.degree, t("Toda tu carrera.", "Tota la teua carrera."));
    if (kind === "course") add("course", undefined, `${world.me.degree} · ${world.me.year}º`, t("Tu carrera y tu año.", "La teua carrera i el teu any."));
    if (kind === "contacts") add("contacts", undefined, t("Mis contactos", "Els meus contactes"), t("Gente con la que ya hablas.", "Gent amb qui ja parles."));
    if (kind === "group") for (const group of world.groups) if (group.members.includes(world.me.id)) add("group", group.id, group.name, t("Los miembros del grupo.", "Els membres del grup."));
  }
  return out;
}

export const canUseAudience = (choice: AudienceChoice) => !choice.blocked;
export const sameAudience = (a: Audience, b: Audience) => a.kind === b.kind && (a.ref ?? "") === (b.ref ?? "");
