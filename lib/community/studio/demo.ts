import { emptyStudio, type StudioData, type StudioInput, type Project, type ProjectSpec, type Submission } from "./types";

// Isolated, disposable examples. Never sent to Supabase or shown as real community activity.
export function createStudioDemo(user: string) {
  const state: StudioData = emptyStudio();
  state.editor = true; // Only the demo grants an editorial role automatically.
  const now = new Date().toISOString();
  const project = (id: string, owner: string, spec: ProjectSpec): Project => ({ id, owner, ...spec, stage: "forming", milestones: [{ title: "Definir la propuesta", done: true }, { title: "Primer prototipo", done: false }, { title: "Probar y presentar", done: false }], result: "", result_url: "", team: [], credits: [], following: false, created_at: now });
  state.projects = [
    project("project-fashion", "demo-paula", { title: "Tu próxima colección, sin probador.", objective: "Un probador virtual para una colección de seis prendas. Queremos una primera demostración en seis semanas.", existing: "Bocetos de la colección y entrevistas con ocho estudiantes.", contribution: "Paula aporta los diseños y la investigación con usuarios.", commitment: "3 horas semanales durante 6 semanas. Una reunión los jueves.", offer: "Aprender y construir portfolio. Sin remuneración. Créditos para todo el equipo.", mode: "Mixto", roles: ["Desarrollo web", "Diseño 3D"], beginners: true }),
    project("project-film", "demo-laia", { title: "Un corto entre dos clases.", objective: "Rodar un cortometraje de cinco minutos sobre el primer día de universidad.", existing: "Guion terminado, localizaciones y dos intérpretes.", contribution: "Laia escribe y dirige. El equipo decide el montaje.", commitment: "Dos tardes de rodaje y cuatro semanas de montaje.", offer: "Pieza para portfolio, créditos y gastos de transporte. Sin remuneración.", mode: "Presencial", roles: ["Sonido directo", "Montaje"], beginners: true }),
    project("project-garden", user, { title: "Un huerto que se riega solo.", objective: "Medir la humedad del huerto del campus y probar un riego que use menos agua.", existing: "Sensores prestados y permiso para una parcela de prueba.", contribution: "Coordino el proyecto y preparo el diseño del experimento.", commitment: "2 horas a la semana durante un mes.", offer: "Aprendizaje compartido y memoria del experimento. Sin remuneración.", mode: "Mixto", roles: ["Electrónica", "Biología"], beginners: true }),
  ];
  state.applications = [{ id: "application-aina", project_id: "project-garden", applicant: "demo-aina", role: "Biología", body: "Puedo diseñar la comparación entre parcelas y documentar el consumo de agua.", availability: "Miércoles por la tarde, dos horas.", portfolio: "", status: "pending" }];
  state.editions = [{ id: "edition-01", title: "Hay cosas que no salen en el horario.", date: now.slice(0,10), published: true }];
  state.submissions = [
    { id: "feature-fashion", author: "demo-paula", title: "La ropa está. Falta quien le dé otra dimensión.", body: "Paula tiene una colección y una pregunta: ¿podemos probarnos una prenda antes de coserla? Busca desarrollo web y diseño 3D para construir una primera demostración en seis semanas.", kind: "project", source_id: "project-fashion", source_url: "", attribution: "Paula Martí", consent: true, edition_id: "edition-01", created_at: now },
    { id: "feature-film", author: "demo-laia", title: "Cinco minutos de cine. Varias carreras detrás.", body: "El guion está terminado. Ahora toca darle sonido y ritmo a una historia sobre llegar a la uni sin conocer a nadie. Se aceptan primeras veces y ganas de aprender.", kind: "project", source_id: "project-film", source_url: "", attribution: "Laia Soler", consent: true, edition_id: "edition-01", created_at: now },
  ];
  return (command: string, input: StudioInput = {}): StudioData => {
    const id = String(input.id ?? ""), p = state.projects.find(x => x.id === id);
    const text = (key: string) => String(input[key] ?? "").trim();
    const team = p && (p.owner === user || p.team.some(x => x.user_id === user));
    if (command === "create_project") {
      const spec = input as unknown as ProjectSpec;
      if (!["title","objective","existing","contribution","commitment","offer"].every(k => text(k).length >= 3) || !Array.isArray(spec.roles) || !spec.roles.length) throw Error("Completa todos los campos y al menos un puesto.");
      state.projects.unshift(project(crypto.randomUUID(), user, structuredClone(spec)));
    } else if (command === "apply" && p) {
      if (p.owner === user || p.stage === "completed" || !p.roles.includes(text("role")) || p.team.some(x => x.role === text("role"))) throw Error("Este puesto no está disponible.");
      if (state.applications.some(x => x.project_id === id && x.applicant === user)) throw Error("Ya has enviado una solicitud.");
      state.applications.push({ id: crypto.randomUUID(), project_id: id, applicant: user, role: text("role"), body: text("body"), availability: text("availability"), portfolio: text("portfolio"), status: "pending" });
    } else if (command === "credit" && p && team && p.stage === "completed") p.credits = input.on ? [...new Set([...p.credits,user])] : p.credits.filter(x=>x!==user);
    else if (command === "follow" && p) p.following = !!input.on;
    else if (command === "decide" && p && p.owner === user) {
      const a = state.applications.find(x => x.id === input.application && x.project_id === id && x.status === "pending");
      if (!a || !["accepted","rejected"].includes(text("status"))) throw Error("Solicitud no disponible.");
      if (input.status === "accepted" && p.team.some(x => x.role === a.role)) throw Error("Ese puesto ya está cubierto.");
      a.status = input.status as "accepted" | "rejected";
      if (a.status === "accepted") p.team.push({ user_id: a.applicant, role: a.role });
    } else if (command === "milestone" && p && team && p.stage !== "completed") p.milestones[Number(input.index)].done = !!input.done;
    else if (command === "stage" && p && p.owner === user && p.stage !== "completed") p.stage = input.stage as "forming" | "building";
    else if (command === "result" && p && p.owner === user) { p.result = text("body"); p.result_url = text("url"); p.stage = "completed"; }
    else if (command === "team_message" && p && team) state.messages.push({ id: crypto.randomUUID(), project_id: id, author: user, body: text("body"), created_at: new Date().toISOString() });
    else if (command === "submit") {
      if (!input.consent) throw Error("Autoriza la tarjeta antes de proponerla.");
      state.submissions.unshift({ id: crypto.randomUUID(), author: user, title: text("title"), body: text("body"), kind: input.kind as Submission["kind"], source_id: text("source_id"), source_url: text("source_url"), attribution: "Álex Torres", consent: true, edition_id: null, created_at: new Date().toISOString() });
    } else if (command === "withdraw") {
      const item = state.submissions.find(x => x.id === id && x.author === user);
      if (!item) throw Error("No puedes retirar esta propuesta.");
      item.consent = false; item.edition_id = null;
    } else if (command === "create_edition") {
      if (state.editions.some(x => x.date === input.date)) throw Error("Ya hay una edición para esa fecha.");
      state.editions.unshift({ id: crypto.randomUUID(), title: text("title"), date: text("date"), published: false });
    } else if (command === "select") {
      const e = state.editions.find(x => x.id === input.edition && !x.published), s = state.submissions.find(x => x.id === id && x.consent);
      if (!e || !s || (input.on && s.edition_id)) throw Error("La selección ya no está disponible.");
      if (input.on && state.submissions.filter(x => x.edition_id === e.id && x.consent).length >= 6) throw Error("Una edición admite hasta seis piezas.");
      s.edition_id = input.on ? e.id : null;
    } else if (command === "publish_edition") {
      const e = state.editions.find(x => x.id === input.edition && !x.published);
      if (!e || !state.submissions.some(x => x.edition_id === e.id && x.consent)) throw Error("Selecciona al menos una pieza autorizada.");
      e.published = true;
    } else if (command !== "read") throw Error("Acción no disponible.");
    return structuredClone({ ...state, applications: state.applications.filter(a => a.applicant === user || state.projects.some(p => p.id === a.project_id && p.owner === user)), messages: state.messages.filter(m => state.projects.some(p => p.id === m.project_id && (p.owner === user || p.team.some(t => t.user_id === user)))) });
  };
}
