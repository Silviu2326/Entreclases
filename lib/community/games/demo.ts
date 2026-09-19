import type { GameKind, Input, Room } from "./types";

type RawMove = { id: string; user: string; name: string; kind: string; body: string; choice: number; reply: string };
type Raw = { id: string; owner: string; name: string; body: string; options: string[]; answer: number; place: string; capacity: number; expires: string | null; players: string[]; moves: RawMove[]; blocked: string[] };
const sessions = new Map<string, Raw[]>();
const uid = () => crypto.randomUUID();
export function demoPlay(kind: GameKind, command: string, input: Input, user: string, name: string): Room[] {
  const key = `${user}:${kind}`;
  if (!sessions.has(key)) {
    const base: Raw = { id: uid(), owner: "sample-player", name: "Lola · ejemplo", body: "", options: [], answer: 1, place: "Tarongers · cafetería", capacity: 3, expires: null, players: ["sample-player"], moves: [], blocked: [] };
    if (kind === "crush") base.body = "Me apetece conocer gente, sin prisas.";
    if (kind === "questions") base.body = "Pregúntame algo";
    if (kind === "debate") { base.body = "Llegar veinte minutos tarde cuenta como asistir."; base.capacity = 2; }
    if (kind === "truth") base.options = ["He cambiado de carrera", "Nunca he probado el café", "Toco la batería"];
    if (kind === "jury") { base.body = "Tu compañero no hizo nada del trabajo. ¿Le pones en la portada?"; base.options = ["Sí, pero hablamos", "No, cada uno se lo gana"]; }
    if (kind === "hangout") { base.body = "Café antes de volver a clase"; base.expires = new Date(Date.now() + 45 * 60000).toISOString(); }
    sessions.set(key, kind === "blind" ? [] : [base]);
  }
  const rooms = sessions.get(key)!;
  const room = rooms.find(r => r.id === input.id);
  const own = rooms.find(r => (r.owner === user || kind === "blind" && r.players.includes(user)) && (!r.expires || Date.parse(r.expires) > Date.now()));
  const move = (r: Raw, type: string, body = "", choice = -1) => { const m = { id: uid(), user, name, kind: type, body, choice, reply: "" }; r.moves.push(m); return m; };
  if (command === "create") {
    if (["crush", "questions", "blind"].includes(kind) && own) throw new Error("Ya estás participando.");
    if (["crush", "blind"].includes(kind) && input.adult !== true) throw new Error("Confirma que eres mayor de edad.");
    if (!["crush", "questions", "blind", "truth"].includes(kind) && !input.body?.trim()) throw new Error("Escribe una propuesta.");
    if (kind === "truth" && (input.options?.length !== 3 || input.options.some(s => !s.trim()) || ![0, 1, 2].includes(input.choice ?? -1))) throw new Error("Escribe tres frases y elige la mentira.");
    if (kind === "jury" && (input.options?.length !== 2 || input.options.some(s => !s.trim()))) throw new Error("Escribe dos posturas.");
    if (["truth", "jury"].includes(kind) && new Set(input.options?.map(s => s.trim().toLowerCase())).size !== input.options?.length) throw new Error("Las opciones deben ser diferentes.");
    if (kind === "hangout" && (!input.place?.trim() || (input.capacity ?? 0) < 2 || (input.capacity ?? 9) > 8)) throw new Error("Revisa el lugar y las plazas.");
    rooms.unshift({ id: uid(), owner: user, name, body: input.body?.trim() || "", options: input.options || [], answer: input.choice ?? -1, place: input.place || "", capacity: input.capacity || 2, expires: kind === "hangout" ? new Date(Date.now() + (input.minutes || 40) * 60000).toISOString() : kind === "blind" ? new Date(Date.now() + 12 * 60000).toISOString() : null, players: [user], moves: [], blocked: [] });
  } else if (command !== "read") {
    if (!room) throw new Error("Esta experiencia ya no está disponible.");
    const isOwner = room.owner === user;
    if (command === "delete") { if (!isOwner) throw new Error("Solo quien lo creó puede cerrarlo."); if (kind === "crush") rooms.forEach(r => { r.moves = r.moves.filter(m => m.user !== user); }); rooms.splice(rooms.indexOf(room), 1); }
    else if (room.expires && Date.parse(room.expires) <= Date.now()) throw new Error("Esta experiencia ha terminado.");
    else if (command === "join") {
      if (!room.players.includes(user)) { if (room.players.length >= room.capacity) throw new Error("No quedan plazas."); room.players.push(user); }
    } else if (command === "leave") { if (isOwner) rooms.splice(rooms.indexOf(room), 1); else room.players = room.players.filter(p => p !== user); }
    else if (command === "vote") {
      const choice = input.choice ?? -1;
      if (kind === "crush" && (!own || isOwner)) throw new Error("Activa tu participación primero.");
      if (kind === "truth" && isOwner) throw new Error("Es tu propia historia.");
      if (kind === "debate" && (room.players.includes(user) || room.moves.filter(m => m.kind === "say").length < 6)) throw new Error("El jurado vota al terminar los seis turnos.");
      const limit = kind === "crush" || kind === "truth" ? 3 : kind === "debate" ? 2 : room.options.length;
      if (!Number.isInteger(choice) || choice < 0 || choice >= limit) throw new Error("Elige una opción válida.");
      if (room.moves.some(m => m.user === user && m.kind === "vote")) throw new Error("Ya has elegido.");
      move(room, "vote", "", choice);
    } else if (command === "say") {
      if (!input.body?.trim()) throw new Error("Escribe algo primero.");
      if (["hangout", "blind", "debate"].includes(kind) && !room.players.includes(user)) throw new Error("Únete primero.");
      if (kind === "debate") { const n = room.moves.filter(m => m.kind === "say").length; if (room.players.length !== 2 || n >= 6 || room.players[n % 2] !== user) throw new Error("Espera tu turno."); }
      if (kind === "questions" && (isOwner || room.blocked.includes(user))) throw new Error("No puedes enviar preguntas a este buzón.");
      if (kind === "questions" && room.moves.filter(m => m.user === user).length >= 5) throw new Error("Has llegado al límite de preguntas de esta prueba.");
      if (kind === "jury" && !room.moves.some(m => m.user === user && m.kind === "vote")) throw new Error("Vota antes de comentar.");
      move(room, "say", input.body.trim());
    } else if (["answer", "dismiss", "block", "report"].includes(command)) {
      const m = room.moves.find(m => m.id === input.move);
      if (kind !== "questions" || !isOwner || !m) throw new Error("Pregunta no disponible.");
      if (command === "answer") { if (!input.body?.trim()) throw new Error("Escribe una respuesta."); m.reply = input.body.trim(); }
      else { if (command === "block" || command === "report") room.blocked.push(m.user); room.moves = room.moves.filter(x => x.id !== m.id && (!(command === "block" || command === "report") || x.user !== m.user || !!x.reply)); }
    } else if (command === "reveal") { if (kind !== "blind" || !room.players.includes(user) || room.players.length !== 2) throw new Error("Espera a tener pareja."); if (!room.moves.some(m => m.user === user && m.kind === "reveal")) move(room, "reveal"); }
    else if (command === "simulate") {
      if (kind === "crush" && own) { own.moves = own.moves.filter(m => m.user !== room.owner || m.kind !== "vote"); own.moves.push({ id: uid(), user: room.owner, name: room.name, kind: "vote", choice: input.choice ?? 0, body: "", reply: "" }); }
      if (kind === "questions" && isOwner) room.moves.push({ id: uid(), user: "sample-player", name: "Ejemplo", kind: "say", body: "¿Qué plan te gustaría hacer después de clase?", reply: "", choice: -1 });
      if (kind === "debate") { if (room.players.length < 2) room.players.push("sample-rival"); const n = room.moves.filter(m => m.kind === "say").length; const other = room.players[n % 2]; if (n < 6 && other !== user) room.moves.push({ id: uid(), user: other, name: "Rival de ejemplo", kind: "say", body: ["La puntualidad está sobrevalorada. Lo importante es la entrada dramática.", "Pero perderte la explicación cuesta más que madrugar.", "Solicito un café y que conste en acta."][Math.floor(n / 2)], choice: -1, reply: "" }); }
      if (kind === "blind") { if (room.players.length === 1) room.players.push("sample-date"); room.moves.push({ id: uid(), user: "sample-date", name: "Compañía de ejemplo", kind: "say", body: "Mi plan perfecto: café, paseo y una conversación que se alarga. ¿El tuyo?", reply: "", choice: -1 }); if (room.moves.some(m => m.user === user && m.kind === "reveal") && !room.moves.some(m => m.user === "sample-date" && m.kind === "reveal")) room.moves.push({ id: uid(), user: "sample-date", name: "Compañía de ejemplo", kind: "reveal", body: "", reply: "", choice: -1 }); }
    }
  }
  return rooms.filter(r => (!r.expires || Date.parse(r.expires) > Date.now()) && (kind !== "blind" || r.players.includes(user))).map(r => {
    const vote = r.moves.find(m => m.user === user && m.kind === "vote");
    const mine = r.owner === user, joined = r.players.includes(user);
    const myRoom = rooms.find(x => x.owner === user);
    const reciprocal = myRoom?.moves.find(m => m.user === r.owner && m.kind === "vote");
    const matched = kind === "crush" && !!vote && !!reciprocal && vote.choice === reciprocal.choice;
    const revealed = kind === "blind" && r.players.length === 2 && r.players.every(p => r.moves.some(m => m.user === p && m.kind === "reveal"));
    return { id: r.id, mine, owner_name: kind === "blind" ? revealed ? r.moves.find(m => m.user !== user)?.name || "Compañía de ejemplo" : "Alguien del campus" : r.name, body: r.body, options: r.options, place: r.place, expires: r.expires, count: r.players.length, capacity: r.capacity, joined, my_choice: vote?.choice ?? null, answer: kind === "truth" && (mine || vote) ? r.answer : null, matched, peer_id: null, revealed, votes: kind === "jury" && !vote ? [] : Array.from({ length: kind === "debate" ? 2 : r.options.length }, (_, i) => r.moves.filter(m => m.kind === "vote" && m.choice === i).length), moves: r.moves.filter(m => kind === "questions" ? !!m.reply || mine : ["crush", "truth"].includes(kind) ? false : m.kind === "say" || m.user === user && m.kind === "reveal").map(m => ({ id: m.id, label: kind === "questions" ? "Anónimo" : kind === "blind" && !revealed ? m.user === user ? "Tú" : "Tu compañía" : m.name, mine: kind !== "questions" && m.user === user, body: m.body, kind: m.kind, reply: m.reply, choice: m.choice })) };
  });
}
