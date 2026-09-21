import { validateProposal, proposalStatus, canEditProposal } from "./proposals";
import { fileLimits } from "./files";
import { emptyStudio, type StudioData, type StudioInput, type Project, type ProjectFile, type ProjectSpec, type Submission } from "./types";

/**
 * The bytes of the demo, kept where the tab can reach them. There is no bucket
 * behind the demo, so a file uploaded here can still be downloaded back.
 */
export const demoFiles = new Map<string, Blob>();

// Isolated, disposable examples. Never sent to Supabase or shown as real community activity.
export function createStudioDemo(user: string) {
  const state: StudioData = emptyStudio();
  state.magazine_version = 2;
  state.editor = true; // Only the demo grants an editorial role automatically.
  const now = new Date().toISOString();
  const project = (id: string, owner: string, spec: ProjectSpec): Project => ({ id, owner, ...spec, stage: "forming", milestones: [{ title: "Definir la propuesta", done: true }, { title: "Primer prototipo", done: false }, { title: "Probar y presentar", done: false }], result: "", result_url: "", team: [], credits: [], following: false, created_at: now });
  state.projects = [
    project("project-fashion", "demo-paula", { title: "Tu próxima colección, sin probador.", objective: "Un probador virtual para una colección de seis prendas. Queremos una primera demostración en seis semanas.", existing: "Bocetos de la colección y entrevistas con ocho estudiantes.", contribution: "Paula aporta los diseños y la investigación con usuarios.", commitment: "3 horas semanales durante 6 semanas. Una reunión los jueves.", offer: "Aprender y construir portfolio. Sin remuneración. Créditos para todo el equipo.", mode: "Mixto", roles: ["Desarrollo web", "Diseño 3D"], beginners: true }),
    project("project-film", "demo-laia", { title: "Un corto entre dos clases.", objective: "Rodar un cortometraje de cinco minutos sobre el primer día de universidad.", existing: "Guion terminado, localizaciones y dos intérpretes.", contribution: "Laia escribe y dirige. El equipo decide el montaje.", commitment: "Dos tardes de rodaje y cuatro semanas de montaje.", offer: "Pieza para portfolio, créditos y gastos de transporte. Sin remuneración.", mode: "Presencial", roles: ["Sonido directo", "Montaje"], beginners: true }),
    project("project-garden", user, { title: "Un huerto que se riega solo.", objective: "Medir la humedad del huerto del campus y probar un riego que use menos agua.", existing: "Sensores prestados y permiso para una parcela de prueba.", contribution: "Coordino el proyecto y preparo el diseño del experimento.", commitment: "2 horas a la semana durante un mes.", offer: "Aprendizaje compartido y memoria del experimento. Sin remuneración.", mode: "Mixto", roles: ["Electrónica", "Biología"], beginners: true }),
  ];
  state.applications = [{ id: "application-aina", project_id: "project-garden", applicant: "demo-aina", role: "Biología", body: "Puedo diseñar la comparación entre parcelas y documentar el consumo de agua.", availability: "Miércoles por la tarde, dos horas.", portfolio: "", status: "pending" }];
  const seededPath = `project-garden/${user}/demo-0000.txt`, seeded = "Parcela de prueba\nSemana 1 · humedad 42 %\nSemana 2 · humedad 38 %\n";
  if (typeof Blob !== "undefined") demoFiles.set(seededPath, new Blob([seeded], { type: "text/plain" }));
  state.files = [{ id: "file-garden", project_id: "project-garden", author: user, path: seededPath, name: "medidas-humedad.txt", note: "Las primeras lecturas de la parcela.", size: seeded.length, kind: "text/plain", created_at: now }];
  state.editions = [{ id: "edition-01", title: "Hay cosas que no salen en el horario.", date: now.slice(0,10), published: true }];
  state.submissions = [
    { id: "feature-fashion", author: "demo-paula", title: "La ropa está. Falta quien le dé otra dimensión.", body: "Paula tiene una colección y una pregunta: ¿podemos probarnos una prenda antes de coserla? Busca desarrollo web y diseño 3D para construir una primera demostración en seis semanas.", kind: "project", source_id: "project-fashion", source_url: "", attribution: "Paula Martí", consent: true, edition_id: "edition-01", created_at: now },
    { id: "feature-film", author: "demo-laia", title: "Cinco minutos de cine. Varias carreras detrás.", body: "El guion está terminado. Ahora toca darle sonido y ritmo a una historia sobre llegar a la uni sin conocer a nadie. Se aceptan primeras veces y ganas de aprender.", kind: "project", source_id: "project-film", source_url: "", attribution: "Laia Soler", consent: true, edition_id: "edition-01", created_at: now },
  ];
  state.submissions = state.submissions.map(s=>({...s,status:"published",summary:"",section:"Proyectos",layout:"classic",images:[],revision:1,history:[{status:"published",at:now,note:"Publicada en la edición de ejemplo."}]}));
  const example = (id: string, title: string, status: Submission["status"], note: string): Submission => ({id,author:user,title,body:"Estamos preparando una tarde para intercambiar ideas y enseñar los primeros bocetos. Buscamos gente de otras carreras que quiera sumarse.",kind:"story",source_id:"",source_url:"",attribution:"Álex Torres",consent:status!=="draft",edition_id:null,created_at:now,updated_at:now,status,summary:"Una propuesta ficticia para probar el seguimiento editorial.",section:"Vida de campus",layout:"classic",images:[],revision:1,author_note:"Ejemplo de la demo.",editorial_note:note,history:[{status:status??"draft",at:now,note}]});
  state.submissions.push(example("my-draft","Una tarde para enseñar lo que hacemos","draft","Borrador guardado. Solo tú lo ves."),example("my-pending","¿Quién se apunta al taller de bocetos?","pending","Propuesta enviada. El equipo la revisará."),example("my-accepted","Un huerto entre varias carreras","accepted","Nos gusta cómo explicas las aportaciones del equipo. Queda pendiente elegir edición."),example("my-rejected","El cartel sin fecha","rejected","Faltan fecha y lugar para que alguien pueda participar. Puedes completarla y volver a enviarla."));
  return (command: string, input: StudioInput = {}): StudioData => {
    const id = String(input.id ?? ""), p = state.projects.find(x => x.id === id);
    const text = (key: string) => String(input[key] ?? "").trim();
    const team = p && (p.owner === user || p.team.some(x => x.user_id === user));
    const files = state.files ?? (state.files = []);
    const spread = ["title","objective","existing","contribution","commitment","offer"] as const;
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
    } else if (command === "update_project" && p) {
      if (p.owner !== user || p.stage === "completed") throw Error("Solo quien impulsa un proyecto abierto puede editarlo.");
      const roles = (Array.isArray(input.roles) ? input.roles : []).map(String).map(role => role.trim()).filter(Boolean);
      if (!spread.every(key => text(key).length >= 3) || !roles.length || roles.length > 6 || new Set(roles).size !== roles.length) throw Error("Completa todos los campos y de uno a seis puestos distintos.");
      if (!["Presencial","Remoto","Mixto"].includes(text("mode"))) throw Error("Elige una modalidad.");
      const held = p.team.map(x => x.role).filter(role => !roles.includes(role));
      if (held.length) throw Error("No puedes quitar un puesto que ya ocupa alguien.");
      const waiting = state.applications.filter(x => x.project_id === id && x.status === "pending").map(x => x.role).filter(role => !roles.includes(role));
      if (waiting.length) throw Error("Responde antes a las solicitudes de ese puesto.");
      const titles = (Array.isArray(input.milestones) ? input.milestones : []).map(String).map(title => title.trim()).filter(Boolean);
      if (!titles.length || titles.length > 6) throw Error("Deja entre uno y seis hitos.");
      // A milestone that keeps its name keeps what the team already ticked.
      const ticked = new Map(p.milestones.map(item => [item.title, item.done]));
      Object.assign(p, Object.fromEntries(spread.map(key => [key, text(key)])), { mode: text("mode"), beginners: !!input.beginners, roles, milestones: titles.map(title => ({ title, done: ticked.get(title) ?? false })) });
    } else if (command === "remove_member" && p) {
      const member = String(input.member ?? "");
      if (p.owner !== user || p.stage === "completed" || !p.team.some(x => x.user_id === member)) throw Error("Esa persona ya no está en el equipo.");
      p.team = p.team.filter(x => x.user_id !== member); p.credits = p.credits.filter(x => x !== member);
      state.applications = state.applications.filter(x => !(x.project_id === id && x.applicant === member));
    } else if (command === "leave_project" && p) {
      if (p.owner === user || p.stage === "completed" || !p.team.some(x => x.user_id === user)) throw Error("No puedes salir de este proyecto.");
      p.team = p.team.filter(x => x.user_id !== user); p.credits = p.credits.filter(x => x !== user);
      state.applications = state.applications.filter(x => !(x.project_id === id && x.applicant === user));
    } else if (command === "withdraw_application" && p) {
      const waiting = state.applications.find(x => x.project_id === id && x.applicant === user && x.status === "pending");
      if (!waiting) throw Error("No tienes ninguna solicitud a la espera en este proyecto.");
      state.applications = state.applications.filter(x => x !== waiting);
    } else if (command === "add_file" && p) {
      if (!team) throw Error("Solo el equipo puede pasar archivos.");
      if (files.filter(x => x.project_id === id).length >= fileLimits.perProject) throw Error("Este proyecto ya ha llegado al límite de archivos.");
      if (!text("path") || !text("name") || Number(input.size ?? 0) < 1) throw Error("Este archivo no se puede guardar.");
      files.unshift({ id: crypto.randomUUID(), project_id: id, author: user, path: text("path"), name: text("name").slice(0, fileLimits.name), note: text("note").slice(0, fileLimits.note), size: Number(input.size), kind: text("kind"), created_at: new Date().toISOString() });
    } else if (command === "remove_file" && p) {
      const file = files.find(x => x.id === input.file && x.project_id === id);
      if (!file || !team || (file.author !== user && p.owner !== user)) throw Error("No puedes borrar este archivo.");
      state.files = files.filter(x => x !== file);
    } else if (command === "milestone" && p && team && p.stage !== "completed") p.milestones[Number(input.index)].done = !!input.done;
    else if (command === "stage" && p && p.owner === user && p.stage !== "completed") p.stage = input.stage as "forming" | "building";
    else if (command === "result" && p && p.owner === user) { p.result = text("body"); p.result_url = text("url"); p.stage = "completed"; }
    else if (command === "team_message" && p && team) state.messages.push({ id: crypto.randomUUID(), project_id: id, author: user, body: text("body"), created_at: new Date().toISOString() });
    else if (command === "submit" || command === "save_submission") {
      const send=command==="submit"||!!input.send;
      const payload={section:"Vida de campus",layout:"classic",images:[],...input};
      validateProposal(payload,send);
      const previous=state.submissions.find(x=>x.id===id&&x.author===user);
      if(id&&(!previous||!canEditProposal(previous)||previous.revision!==input.revision))throw Error("Esta propuesta ha cambiado o no se puede editar. Recarga antes de guardar.");
      if(input.kind==="project"&&text("source_id")&&!state.projects.some(p=>p.id===input.source_id&&p.owner===user))throw Error("Solo puedes proponer un proyecto propio.");
      const stamp=new Date().toISOString(),status=send?"pending":"draft";
      const item:Submission={id:previous?.id??crypto.randomUUID(),author:user,title:text("title"),body:text("body"),kind:input.kind as Submission["kind"],source_id:text("source_id"),source_url:text("source_url"),attribution:"Álex Torres",consent:send,edition_id:null,created_at:previous?.created_at??stamp,updated_at:stamp,status,summary:text("summary"),section:String(payload.section),layout:payload.layout as Submission["layout"],images:structuredClone(payload.images) as Submission["images"],author_note:text("author_note"),editorial_note:"",revision:(previous?.revision??0)+1,history:[...(previous?.history??[]),{status,at:stamp,note:send?"Versión autorizada y enviada a revisión.":"Borrador guardado."}]};
      if(previous)state.submissions[state.submissions.indexOf(previous)]=item;else state.submissions.unshift(item);
    } else if(command==="review_submission") {
      const item=state.submissions.find(x=>x.id===id&&x.consent&&proposalStatus(x)==="pending");
      if(!state.editor||!item)throw Error("La propuesta ya no está pendiente de revisión.");
      if(!["accepted","rejected","changes_requested"].includes(text("status"))||text("note").length>1000||(input.status!=="accepted"&&text("note").length<5))throw Error("Explica el motivo de la decisión.");
      item.status=input.status as Submission["status"];item.editorial_note=text("note");item.revision=(item.revision??0)+1;item.updated_at=new Date().toISOString();
      item.history=[...(item.history??[]),{status:item.status!,at:item.updated_at,note:text("note")}];
    } else if (command === "withdraw") {
      const item = state.submissions.find(x => x.id === id && x.author === user && x.consent);
      if (!item) throw Error("No puedes retirar esta propuesta.");
      item.consent = false; item.edition_id = null;item.status="withdrawn";item.revision=(item.revision??0)+1;item.updated_at=new Date().toISOString();
      item.history=[...(item.history??[]),{status:"withdrawn",at:item.updated_at,note:"Has retirado el permiso."}];
    } else if (command === "create_edition") {
      if (state.editions.some(x => x.date === input.date)) throw Error("Ya hay una edición para esa fecha.");
      state.editions.unshift({ id: crypto.randomUUID(), title: text("title"), date: text("date"), published: false });
    } else if (command === "select") {
      const e = state.editions.find(x => x.id === input.edition && !x.published), s = state.submissions.find(x => x.id === id && x.consent && proposalStatus(x)==="accepted");
      if (!e || !s || (input.on && s.edition_id)) throw Error("La selección ya no está disponible.");
      if (input.on && state.submissions.filter(x => x.edition_id === e.id && x.consent).length >= 6) throw Error("Una edición admite hasta seis piezas.");
      s.edition_id = input.on ? e.id : null;
    } else if (command === "publish_edition") {
      const e = state.editions.find(x => x.id === input.edition && !x.published);
      if (!e || !state.submissions.some(x => x.edition_id === e.id && x.consent)) throw Error("Selecciona al menos una pieza autorizada.");
      e.published = true;
      for(const item of state.submissions.filter(s=>s.edition_id===e.id&&s.consent)){item.status="published";item.revision=(item.revision??0)+1;item.history=[...(item.history??[]),{status:"published",at:new Date().toISOString(),note:"Publicada en una edición."}];}
    } else if (command !== "read") throw Error("Acción no disponible.");
    const inTeam = (project: string) => state.projects.some(p => p.id === project && (p.owner === user || p.team.some(t => t.user_id === user)));
    return structuredClone({ ...state, applications: state.applications.filter(a => a.applicant === user || state.projects.some(p => p.id === a.project_id && p.owner === user)), messages: state.messages.filter(m => inTeam(m.project_id)), files: (state.files ?? []).filter(f => inTeam(f.project_id)) });
  };
}
