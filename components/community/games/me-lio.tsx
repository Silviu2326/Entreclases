"use client";
import { useState } from "react";
import { Coffee, Flame, Heart, LogOut, Pause, Play, Search, Sparkles, X } from "lucide-react";
import { GameShell, useGame } from "./shared";
import { GameHead, Steps, Tiles, Suggestions, Deck, PersonLine, IdentityNote, Nothing } from "./ui";
import { Action, Avatar, Confirm } from "../controls";
import type { GamePerson } from "@/lib/community/games/types";
import type { ChoiceView, Level, State } from "@/lib/community/games/demo/crush";
import "./me-lio.css";

const lineSuggestions = [
  ["Se me da bien escuchar y fatal bailar.", "Se'm dona bé escoltar i fatal ballar."],
  ["Pregúntame por la última serie que he abandonado.", "Pregunta'm per l'última sèrie que he abandonat."],
  ["Café por las mañanas, filosofía por las noches.", "Cafè pels matins, filosofia per les nits."],
  ["Siempre tengo un sitio favorito nuevo para comer.", "Sempre tinc un lloc favorit nou per a menjar."],
  ["Mejor con plan que sin plan.", "Millor amb pla que sense pla."],
  ["No prometo responder rápido, prometo responder bien.", "No promet respondre ràpid, promet respondre bé."],
];

function levelLabel(level: Level, t: (es: string, va: string) => string) {
  if (level === "coffee") return t("Un café", "Un cafè");
  if (level === "date") return t("Una cita", "Una cita");
  return t("Me lío", "M'embolique");
}
function levelIcon(level: Level) {
  if (level === "coffee") return <Coffee aria-hidden="true" />;
  if (level === "date") return <Heart aria-hidden="true" />;
  return <Flame aria-hidden="true" />;
}

type Draft = { seeMe: "campus" | "site" | "degree"; hideCourse: boolean; hideGroups: boolean; hidePeople: string[] };

/** The search-and-toggle list used both when joining and later, in ajustes, to hide specific people. */
function HidePeoplePicker({ people, value, onChange, t }: { people: GamePerson[]; value: string[]; onChange: (ids: string[]) => void; t: (es: string, va: string) => string }) {
  const [query, setQuery] = useState("");
  const matches = query.trim() ? people.filter(person => person.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 6) : [];
  const hidden = people.filter(person => value.includes(person.id));
  return <div className="g-crush-hide">
    <label className="sr-only" htmlFor="g-crush-hide-search">{t("Buscar a alguien para ocultarte de ella", "Buscar algú per a amagar-te'n")}</label>
    <input id="g-crush-hide-search" className="g-input" type="search" autoComplete="off" placeholder={t("Ocultarte de alguien en concreto…", "Amagar-te d'algú en concret…")} value={query} onChange={event => setQuery(event.target.value)} />
    {matches.length > 0 && <div className="g-crush-hide-results">{matches.map(person => <button type="button" key={person.id} onClick={() => { onChange([...value, person.id]); setQuery(""); }}>{person.name}<small>{person.degree}</small></button>)}</div>}
    {hidden.length > 0 && <div className="g-crush-chips">{hidden.map(person => <span key={person.id} className="g-crush-chip">{person.name}<button type="button" aria-label={t("Dejar de ocultarte", "Deixar d'amagar-te'n")} onClick={() => onChange(value.filter(id => id !== person.id))}><X aria-hidden="true" /></button></span>)}</div>}
  </div>;
}

function privacyOptions(t: (es: string, va: string) => string, visible: [string, string], hidden: [string, string]) {
  return [{ value: "off", label: t(...visible) }, { value: "on", label: t(...hidden) }];
}

export default function MeLio() {
  const g = useGame<State>("crush");
  const s = g.state;
  const [step, setStep] = useState(0);
  const [adult, setAdult] = useState<"" | "yes" | "no">("");
  const [draft, setDraft] = useState<Draft>({ seeMe: "campus", hideCourse: true, hideGroups: false, hidePeople: [] });
  const [line, setLine] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [search, setSearch] = useState("");

  if (!s) return <GameShell game={g}>{null}</GameShell>;
  const t = g.t;

  const settingsSummary = (v: State["visibility"]) => {
    const parts: string[] = [];
    parts.push(v.seeMe === "campus" ? t("te ve todo el campus", "et veu tot el campus") : v.seeMe === "site" ? t("te ve tu sede", "et veu la teua seu") : t("te ve tu carrera", "et veu la teua carrera"));
    if (v.hideCourse) parts.push(t("oculta de tu curso", "amagat del teu curs"));
    if (v.hideGroups) parts.push(t("oculta de tus grupos", "amagat dels teus grups"));
    if (v.hidePeople.length) parts.push(t(`oculta de ${v.hidePeople.length} personas concretas`, `amagat de ${v.hidePeople.length} persones concretes`));
    return parts.join(" · ");
  };

  // --- Not in the game yet: the three-step entry. ---
  if (!s.joined) {
    const steps = [t("Mayoría de edad", "Majoria d'edat"), t("Quién me ve", "Qui em veu"), t("Tu frase", "La teua frase")];
    return <GameShell game={g}><div className="g-crush g-crush-onboarding">
      <GameHead title={t("¿Me lío?", "M'embolique?")} body={t("Un café, una cita o algo más. Nadie lo sabe salvo que sea mutuo.", "Un cafè, una cita o alguna cosa més. Ningú ho sap llevat que siga mutu.")} />
      <Steps steps={steps} current={step} onBack={step > 0 ? () => setStep(value => value - 1) : undefined} />
      {step === 0 && <div className="g-stack">
        <Tiles label={t("¿Tienes 18 años o más?", "Tens 18 anys o més?")} columns={2} value={adult}
          onChange={value => setAdult(value as "yes" | "no")}
          options={[{ value: "yes", label: t("Sí, tengo 18 o más", "Sí, tinc 18 o més") }, { value: "no", label: t("Todavía no", "Encara no") }]} />
        {adult === "no" && <Nothing title={t("Este juego es solo para mayores de edad.", "Este joc és només per a majors d'edat.")} body={t("Vuelve cuando cumplas 18.", "Torna quan complisques 18.")} />}
        {adult === "yes" && <Action onClick={() => setStep(1)}>{t("Continuar", "Continuar")}</Action>}
      </div>}
      {step === 1 && <div className="g-stack">
        <Tiles label={t("Me ve", "Em veu")} columns={3} value={draft.seeMe} onChange={value => setDraft(d => ({ ...d, seeMe: value as Draft["seeMe"] }))}
          options={[{ value: "campus", label: t("Todo el campus", "Tot el campus") }, { value: "site", label: t("Mi sede", "La meua seu") }, { value: "degree", label: t("Mi carrera", "La meua carrera") }]} />
        <p className="g-muted">{t("Ocultarme de", "Amagar-me de")}</p>
        <Tiles label={t("Ocultarme de mi curso", "Amagar-me del meu curs")} columns={2} value={draft.hideCourse ? "on" : "off"} onChange={value => setDraft(d => ({ ...d, hideCourse: value === "on" }))} options={privacyOptions(t, ["Mostrarme a mi curso", "Mostrar-me al meu curs"], ["Ocultarme de mi curso", "Amagar-me del meu curs"])} />
        <Tiles label={t("Ocultarme de mis grupos", "Amagar-me dels meus grups")} columns={2} value={draft.hideGroups ? "on" : "off"} onChange={value => setDraft(d => ({ ...d, hideGroups: value === "on" }))} options={privacyOptions(t, ["Mostrarme a mis grupos", "Mostrar-me als meus grups"], ["Ocultarme de mis grupos", "Amagar-me dels meus grups"])} />
        <HidePeoplePicker people={g.world.people} value={draft.hidePeople} onChange={ids => setDraft(d => ({ ...d, hidePeople: ids }))} t={t} />
        <IdentityNote>{t("La visibilidad es recíproca: si te ocultas de alguien, esa persona tampoco aparece en tu baraja.", "La visibilitat és recíproca: si t'amagues d'algú, eixa persona tampoc apareix en la teua baralla.")}</IdentityNote>
        <Action onClick={() => setStep(2)}>{t("Continuar", "Continuar")}</Action>
      </div>}
      {step === 2 && <div className="g-stack">
        <Suggestions label={t("Sugerencias", "Suggeriments")} options={lineSuggestions.map(pair => t(pair[0], pair[1]))} onUse={setLine} />
        <label className="sr-only" htmlFor="g-crush-line">{t("Tu frase", "La teua frase")}</label>
        <input id="g-crush-line" className="g-input" maxLength={140} value={line} onChange={event => setLine(event.target.value)} placeholder={t("Lo que aparece bajo tu nombre en la baraja (opcional).", "El que apareix davall del teu nom en la baralla (opcional).")} />
        <IdentityNote>{t(`Entras con: ${settingsSummary(draft)}.`, `Entres amb: ${settingsSummary(draft)}.`)}</IdentityNote>
        <Action onClick={() => void g.act("join", { adult: true, ...draft, line })} disabled={g.busy}>{t("Entrar al juego", "Entrar al joc")}</Action>
      </div>}
    </div></GameShell>;
  }

  // --- Paused: nothing else shows, per the design. ---
  if (s.paused) return <GameShell game={g}><div className="g-crush">
    <Nothing title={t("No apareces en ninguna baraja.", "No apareixes en cap baralla.")} body={t("Tus elecciones siguen guardadas. Vuelve cuando quieras.", "Les teues eleccions continuen guardades. Torna quan vulgues.")}
      action={<Action onClick={() => void g.act("resume")} disabled={g.busy}><Play aria-hidden="true" />{t("Volver a jugar", "Tornar a jugar")}</Action>} />
  </div></GameShell>;

  // --- A match: its own full screen, before anything else. ---
  if (s.celebrate) {
    const match = s.celebrate;
    const other = g.person(match.id);
    return <GameShell game={g}><div className="g-crush g-crush-celebrate" role="status">
      <Sparkles aria-hidden="true" className="g-crush-celebrate-spark" />
      <h2>{t("¡Hay coincidencia!", "Hi ha coincidència!")}</h2>
      <div className="g-crush-celebrate-photos">
        <Avatar person={g.me} size="large" /><Avatar person={other} size="large" />
      </div>
      <p>{t(`A las dos os apetece ${levelLabel(match.level, t).toLowerCase()}.`, `A les dues vos abellix ${levelLabel(match.level, t).toLowerCase()}.`)}</p>
      <div className="g-actions">
        <Action onClick={() => void g.chat(match.id)}>{t("Abrir el chat", "Obrir el xat")}</Action>
        <Action secondary onClick={() => void g.act("ack-match", { id: match.id })} disabled={g.busy}>{t("Seguir", "Continuar")}</Action>
      </div>
    </div></GameShell>;
  }

  const person = s.search.query ? undefined : s.deck.person;
  const searching = s.search.query.trim().length > 0;

  const gestureButtons = (id: string, current?: Level) => <div className="g-crush-gestures" role="group" aria-label={t("Elige qué te apetece", "Tria què t'abellix")}>
    {(["coffee", "date", "crush"] as const).map(level => <button key={level} type="button" className={current === level ? "g-crush-gesture on" : "g-crush-gesture"} aria-pressed={current === level} disabled={g.busy} onClick={() => void g.act(current !== undefined ? "change" : "choose", { id, level })}>{levelIcon(level)}<span>{levelLabel(level, t)}</span></button>)}
  </div>;

  return <GameShell game={g}><div className="g-crush">
    <GameHead title={t("¿Me lío?", "M'embolique?")} body={t(`Te quedan ${s.remainingToday} personas hoy.`, `Et queden ${s.remainingToday} persones hui.`)}
      aside={<div className="g-actions">
        <Action secondary onClick={() => void g.act("pause")} disabled={g.busy}><Pause aria-hidden="true" />{t("Pausar", "Pausar")}</Action>
        <Confirm title={t("¿Salir del juego?", "Eixir del joc?")} description={t("Se revocan todas tus elecciones sin coincidencia. Los chats ya abiertos siguen igual.", "Es revoquen totes les teues eleccions sense coincidència. Els xats ja oberts continuen igual.")} onConfirm={() => g.act("leave")}>
          <Action secondary><LogOut aria-hidden="true" />{t("Salir", "Eixir")}</Action>
        </Confirm>
      </div>} />
    <IdentityNote>{t(`Ahora mismo: ${settingsSummary(s.visibility)}.`, `Ara mateix: ${settingsSummary(s.visibility)}.`)} <button type="button" className="g-link" onClick={() => setShowSettings(value => !value)}>{showSettings ? t("Ocultar ajustes", "Amagar ajustos") : t("Cambiar quién me ve", "Canviar qui em veu")}</button></IdentityNote>

    {showSettings && <div className="g-panel g-crush-settings">
      <Tiles label={t("Me ve", "Em veu")} columns={3} value={s.visibility.seeMe} onChange={value => void g.act("settings", { seeMe: value })}
        options={[{ value: "campus", label: t("Todo el campus", "Tot el campus") }, { value: "site", label: t("Mi sede", "La meua seu") }, { value: "degree", label: t("Mi carrera", "La meua carrera") }]} />
      <Tiles label={t("Ocultarme de mi curso", "Amagar-me del meu curs")} columns={2} value={s.visibility.hideCourse ? "on" : "off"} onChange={value => void g.act("settings", { hideCourse: value === "on" })} options={privacyOptions(t, ["Mostrarme a mi curso", "Mostrar-me al meu curs"], ["Ocultarme de mi curso", "Amagar-me del meu curs"])} />
      <Tiles label={t("Ocultarme de mis grupos", "Amagar-me dels meus grups")} columns={2} value={s.visibility.hideGroups ? "on" : "off"} onChange={value => void g.act("settings", { hideGroups: value === "on" })} options={privacyOptions(t, ["Mostrarme a mis grupos", "Mostrar-me als meus grups"], ["Ocultarme de mis grupos", "Amagar-me dels meus grups"])} />
      <HidePeoplePicker people={g.world.people} value={s.visibility.hidePeople} onChange={ids => void g.act("settings", { hidePeople: ids })} t={t} />
      <label className="sr-only" htmlFor="g-crush-line-edit">{t("Tu frase", "La teua frase")}</label>
      <input id="g-crush-line-edit" className="g-input" maxLength={140} defaultValue={s.line} onBlur={event => void g.act("settings", { line: event.target.value })} placeholder={t("Tu frase (opcional)", "La teua frase (opcional)")} />
    </div>}

    <form className="g-crush-search" onSubmit={event => { event.preventDefault(); void g.act("search", { query: search }); }}>
      <label className="sr-only" htmlFor="g-crush-search">{t("Buscar a alguien por nombre", "Buscar algú pel nom")}</label>
      <input id="g-crush-search" className="g-input" type="search" autoComplete="off" placeholder={t("Buscar a alguien…", "Buscar algú…")} value={search} onChange={event => setSearch(event.target.value)} />
      <button type="submit" aria-label={t("Buscar", "Buscar")}><Search aria-hidden="true" /></button>
      {searching && <button type="button" className="g-link" onClick={() => { setSearch(""); void g.act("search", { query: "" }); }}>{t("Cerrar búsqueda", "Tancar cerca")}</button>}
    </form>

    {searching && (s.search.result
      ? <div className="g-deck-card g-crush-card">
          <Avatar person={g.person(s.search.result.id)} size="large" />
          <h3>{s.search.result.name}</h3>
          <p className="g-muted">{s.search.result.degree} · {s.search.result.year}º</p>
          <p className="g-crush-line">“{s.search.result.line}”</p>
          {gestureButtons(s.search.result.id, s.choices.find(choice => choice.id === s.search.result?.id)?.level)}
        </div>
      : <p className="g-muted" role="status">{t("No está en el juego o no puedes verla.", "No està en el joc o no la pots veure.")}</p>)}

    {!searching && (person
      ? <Deck position={s.deck.position} total={s.deck.total} onSkip={() => void g.act("pass", { id: person.id })} skipLabel={t("Pasar", "Passar")}>
          <div className="g-crush-card">
            <Avatar person={g.person(person.id)} size="large" />
            <h3>{person.name}</h3>
            <p className="g-muted">{person.degree} · {person.year}º</p>
            <p className="g-crush-line">“{person.line}”</p>
            {gestureButtons(person.id)}
          </div>
        </Deck>
      : <Nothing title={t("Por hoy ya está.", "Per hui ja està.")} body={t("Mañana, veinte más. Mientras, mira tus elecciones.", "Demà, vint més. Mentrestant, mira les teues eleccions.")} />)}

    {s.choices.length > 0 && <section className="g-panel g-crush-choices">
      <h3>{t("Mis elecciones", "Les meues eleccions")}</h3>
      {s.choices.map((choice: ChoiceView) => <div key={choice.id} className="g-crush-choice">
        <PersonLine person={g.person(choice.id)} detail={`${choice.degree} · ${choice.year}º`} />
        {gestureButtons(choice.id, choice.level)}
        <div className="g-actions">
          <Action secondary onClick={() => void g.act("demo-match", { id: choice.id })} disabled={g.busy}>{t("Demo: que también te elija", "Demo: que també et trie")}</Action>
          <Confirm title={t("¿Retirar esta elección?", "Retirar esta elecció?")} description={t("Puedes volver a elegir más tarde si reaparece en tu baraja.", "Pots tornar a triar més tard si reapareix en la teua baralla.")} onConfirm={() => g.act("withdraw", { id: choice.id })}>
            <Action secondary>{t("Retirar", "Retirar")}</Action>
          </Confirm>
        </div>
      </div>)}
    </section>}

    {s.matches.length > 0 && <section className="g-panel g-crush-matches">
      <h3>{t("Mis coincidencias", "Les meues coincidències")}</h3>
      {s.matches.map(match => <div key={match.id} className="g-crush-match">
        <PersonLine person={g.person(match.id)} detail={levelLabel(match.level, t)} />
        <Action secondary onClick={() => void g.chat(match.id)}>{t("Abrir chat", "Obrir xat")}</Action>
      </div>)}
    </section>}
  </div></GameShell>;
}
