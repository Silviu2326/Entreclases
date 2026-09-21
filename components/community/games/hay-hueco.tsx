"use client";
import { useState, type ReactNode } from "react";
import { Coffee, UtensilsCrossed, BookOpen, Footprints, Dumbbell, Sparkles, MapPin, DoorOpen, Plus, CheckCircle2, LogOut, Users2 } from "lucide-react";
import { GameShell, useGame, useGameTarget, type Game } from "./shared";
import { GameHead, Steps, Tiles, AudiencePicker, Suggestions, Countdown, IdentityNote, Nothing, Segmented, Conversation, Bubble, Composer } from "./ui";
import { Action, Avatar, Confirm } from "../controls";
import { useCommunity } from "../context";
import type { State, HangoutCard, HangoutDetail, RepeatPrompt } from "@/lib/community/games/demo/hangout";
import type { Audience, AudienceKind } from "@/lib/community/games/types";
import "./hay-hueco.css";

const WHAT_ICON: Record<string, ReactNode> = {
  cafe: <Coffee aria-hidden="true" />, comer: <UtensilsCrossed aria-hidden="true" />, estudiar: <BookOpen aria-hidden="true" />,
  pasear: <Footprints aria-hidden="true" />, deporte: <Dumbbell aria-hidden="true" />, otra: <Sparkles aria-hidden="true" />,
};
const PLACE_ICON: Record<string, ReactNode> = {
  cafeteria: <Coffee aria-hidden="true" />, biblioteca: <BookOpen aria-hidden="true" />, cesped: <Sparkles aria-hidden="true" />,
  entrada: <DoorOpen aria-hidden="true" />, otro: <MapPin aria-hidden="true" />,
};
/** Percentage coordinates on the schematic campus plan, one per known place. */
const MAP_SPOT: Record<string, [number, number]> = { cafeteria: [18, 68], biblioteca: [78, 24], cesped: [48, 52], entrada: [50, 90] };
const DURATIONS = [15, 30, 45, 60, 90, 120];
const AUDIENCE_KINDS: AudienceKind[] = ["site", "course", "degree", "contacts", "group", "campus", "person"];

function durationLabel(t: (es: string, va: string) => string, minutes: number) {
  if (minutes < 60) return t(`${minutes} min`, `${minutes} min`);
  if (minutes === 60) return t("1 h", "1 h");
  if (minutes === 90) return t("1 h 30", "1 h 30");
  return t("2 h", "2 h");
}
function timeLabel(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "va" ? "ca-ES" : "es-ES", { hour: "2-digit", minute: "2-digit" });
}
function whenLabel(t: (es: string, va: string) => string, started: boolean, minutes: number) {
  if (started) return t("Ya ha empezado", "Ja ha començat");
  if (minutes <= 0) return t("Empieza ya", "Comença ja");
  return t(`Empieza en ${minutes} min`, `Comença en ${minutes} min`);
}

export default function HayHueco() {
  const g = useGame<State>("hangout");
  return <GameShell game={g}>{g.state && <Screen g={g} />}</GameShell>;
}

function Screen({ g }: { g: Game<State> }) {
  const s = g.state as State;
  // Coming from someone's profile: if they already have a hangout open it is
  // in the list to join; if not, open one that only they will see.
  const target = useGameTarget();
  const [invite, setInvite] = useState(() => !!target && !s.discover.some(item => item.owner === target));
  const [creating, setCreating] = useState(invite);
  const close = () => { setCreating(false); setInvite(false); };
  if (s.active) return <ActiveView g={g} detail={s.active} />;
  if (s.repeat) return <RepeatView g={g} repeat={s.repeat} />;
  if (creating) return <CreateView g={g} state={s} to={invite && target ? target : undefined} onDone={close} onCancel={close} />;
  const discover = target ? [...s.discover].sort((a, b) => Number(b.owner === target) - Number(a.owner === target)) : s.discover;
  return <DiscoverView g={g} state={{ ...s, discover }} onCreate={() => setCreating(true)} />;
}

// ---- Finding a hangout: "Ahora" and "Mapa" ----

function DiscoverView({ g, state, onCreate }: { g: Game<State>; state: State; onCreate: () => void }) {
  const t = g.t;
  const [tab, setTab] = useState("now");
  return <div className="g-hangout">
    <GameHead title={t("Hay hueco", "Hi ha lloc")} body={t("Un rato libre, hoy, en el campus.", "Una estona lliure, hui, al campus.")}
      aside={<Action onClick={onCreate}><Plus aria-hidden="true" />{t("Abrir un hueco", "Obri un forat")}</Action>} />
    {state.discover.length === 0
      ? <Nothing title={t("Nadie ha abierto hueco todavía.", "Encara ningú ha obert un forat.")} body={t("Si lo abres tú, avisamos a tu sede.", "Si l'obris tu, avisem la teua seu.")} action={<Action onClick={onCreate}><Plus aria-hidden="true" />{t("Abrir un hueco", "Obri un forat")}</Action>} />
      : <>
        <Segmented label={t("Vista", "Vista")} value={tab} onChange={setTab} options={[{ value: "now", label: t("Ahora", "Ara") }, { value: "map", label: t("Mapa", "Mapa") }]} />
        {tab === "now" ? <NowList g={g} items={state.discover} /> : <CampusMap g={g} items={state.discover} />}
      </>}
  </div>;
}

function NowList({ g, items }: { g: Game<State>; items: HangoutCard[] }) {
  const t = g.t;
  return <ul className="g-hangout-list">
    {items.map(item => <li key={item.id} className="g-hangout-card">
      <span className="g-hangout-card-icon" aria-hidden="true">{WHAT_ICON[item.what]}</span>
      <div className="g-hangout-card-body">
        <strong>{item.whatLabel}</strong>
        <span className="g-muted">{PLACE_ICON[item.place]} {item.placeLabel}</span>
        <span className="g-hangout-when">{whenLabel(t, item.started, item.startsInMinutes)}</span>
        <div className="g-hangout-going">
          {item.going.slice(0, 5).map(id => <Avatar key={id} size="small" person={g.person(id)} />)}
          <small>{item.full ? t("Completo", "Complet") : t(`${item.spotsLeft} plazas libres`, `${item.spotsLeft} places lliures`)}</small>
        </div>
      </div>
      <Action disabled={item.full || g.busy} onClick={() => void g.act("join", { id: item.id })}>{t("Me apunto", "M'apunte")}</Action>
    </li>)}
  </ul>;
}

function CampusMap({ g, items }: { g: Game<State>; items: HangoutCard[] }) {
  const t = g.t;
  const byPlace = new Map<string, HangoutCard[]>();
  for (const item of items) byPlace.set(item.place, [...(byPlace.get(item.place) ?? []), item]);
  return <div className="g-hangout-map">
    <svg viewBox="0 0 100 100" role="img" aria-label={t("Plano del campus con los huecos abiertos", "Plànol del campus amb els forats oberts")}>
      <rect x="2" y="2" width="96" height="96" rx="5" className="g-hangout-ground" />
      <rect x="8" y="54" width="24" height="26" rx="2" className="g-hangout-building" />
      <text x="20" y="59" className="g-hangout-map-label">{t("Cafetería", "Cafeteria")}</text>
      <rect x="64" y="8" width="28" height="28" rx="2" className="g-hangout-building" />
      <text x="78" y="14" className="g-hangout-map-label">{t("Biblioteca", "Biblioteca")}</text>
      <circle cx="48" cy="52" r="17" className="g-hangout-lawn" />
      <text x="48" y="41" className="g-hangout-map-label">{t("Césped", "Gespa")}</text>
      <rect x="36" y="84" width="28" height="9" rx="2" className="g-hangout-door" />
      <text x="50" y="81" className="g-hangout-map-label">{t("Entrada", "Entrada")}</text>
      {[...byPlace.entries()].map(([place, at]) => at.map((item, index) => {
        const [x0, y0] = MAP_SPOT[place] ?? [50, 50];
        const angle = (index / Math.max(1, at.length)) * Math.PI * 2;
        const spread = at.length > 1 ? 7 : 0;
        return <circle key={item.id} className={item.started ? "g-hangout-pin on" : "g-hangout-pin"} cx={x0 + Math.cos(angle) * spread} cy={y0 + Math.sin(angle) * spread} r="3.4">
          <title>{`${item.whatLabel} · ${item.placeLabel}`}</title>
        </circle>;
      }))}
    </svg>
    <ul className="g-hangout-map-legend">
      {items.map(item => <li key={item.id}>
        <span className={item.started ? "g-hangout-map-dot on" : "g-hangout-map-dot"} aria-hidden="true" />
        <span>{item.whatLabel} · {item.placeLabel} · {whenLabel(t, item.started, item.startsInMinutes)}</span>
        <Action secondary disabled={item.full || g.busy} onClick={() => void g.act("join", { id: item.id })}>{t("Me apunto", "M'apunte")}</Action>
      </li>)}
    </ul>
  </div>;
}

// ---- Opening a hangout: four taps ----

type Draft = {
  what: string; whatText: string;
  place: string; placeText: string;
  startMode: string; startsAt: string; duration: number;
  audience: Audience; capacity: number; note: string;
};

function CreateView({ g, state, to, onDone, onCancel }: { g: Game<State>; state: State; to?: string; onDone: () => void; onCancel: () => void }) {
  const t = g.t;
  const { data } = useCommunity();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({ what: "", whatText: "", place: "", placeText: "", startMode: "now", startsAt: "", duration: 30, audience: to ? { kind: "person", ref: to } : { kind: "site" }, capacity: to ? 2 : 4, note: "" });
  const patch = (partial: Partial<Draft>) => setDraft(current => ({ ...current, ...partial }));
  const steps = [t("Qué", "Què"), t("Dónde", "On"), t("Cuándo", "Quan"), t("Con quién", "Amb qui")];

  const canNext = step === 0 ? !!draft.what && (draft.what !== "otra" || draft.whatText.trim().length > 0)
    : step === 1 ? !!draft.place && (draft.place !== "otro" || draft.placeText.trim().length > 0)
    : step === 2 ? !!draft.startMode && (draft.startMode !== "at" || !!draft.startsAt)
    : true;

  const submit = async () => {
    const ok = await g.act("create", {
      what: draft.what, whatText: draft.whatText, place: draft.place, placeText: draft.placeText,
      startMode: draft.startMode, startsAt: draft.startsAt, duration: draft.duration,
      audienceKind: draft.audience.kind, audienceRef: draft.audience.ref, capacity: draft.capacity, note: draft.note,
    });
    if (ok) onDone();
  };

  return <div className="g-hangout g-hangout-create">
    <GameHead title={t("Abrir un hueco", "Obri un forat")} body={t("Cuatro toques y listo. No hace falta escribir nada.", "Quatre tocs i llest. No cal escriure res.")} />
    <Steps steps={steps} current={step} onBack={() => (step === 0 ? onCancel() : setStep(step - 1))} />

    {step === 0 && <div className="g-stack">
      <Tiles label={t("¿Qué vais a hacer?", "Què fareu?")} columns={3} value={draft.what} onChange={value => patch({ what: value })}
        options={state.whatOptions.map(option => ({ value: option.id, label: option.label, icon: WHAT_ICON[option.id] }))} />
      {draft.what === "otra" && <input className="g-input" maxLength={40} placeholder={t("¿Qué plan es?", "Quin pla és?")} value={draft.whatText} onChange={event => patch({ whatText: event.target.value })} />}
    </div>}

    {step === 1 && <div className="g-stack">
      <Tiles label={t("¿Dónde?", "On?")} columns={3} value={draft.place} onChange={value => patch({ place: value })}
        options={[...state.places.map(place => ({ value: place.id, label: place.label, icon: PLACE_ICON[place.id] })), { value: "otro", label: t("Otro sitio", "Un altre lloc"), icon: PLACE_ICON.otro }]} />
      {draft.place === "otro" && <input className="g-input" maxLength={60} placeholder={t("¿Dónde quedáis?", "On quedeu?")} value={draft.placeText} onChange={event => patch({ placeText: event.target.value })} />}
    </div>}

    {step === 2 && <div className="g-stack">
      <Tiles label={t("¿Cuándo empieza?", "Quan comença?")} columns={2} value={draft.startMode} onChange={value => patch({ startMode: value, startsAt: "" })}
        options={[
          { value: "now", label: t("Ahora", "Ara") },
          { value: "15", label: t("En 15 min", "En 15 min") },
          { value: "30", label: t("En 30 min", "En 30 min") },
          { value: "at", label: t("A una hora de hoy", "A una hora d'avui") },
        ]} />
      {draft.startMode === "at" && <Tiles label={t("¿A qué hora?", "A quina hora?")} columns={3} value={draft.startsAt} onChange={value => patch({ startsAt: value })}
        options={state.timeSlots.map(slot => ({ value: slot, label: timeLabel(slot, g.world.locale) }))} />}
      <Tiles label={t("¿Cuánto dura?", "Quant dura?")} columns={3} value={String(draft.duration)} onChange={value => patch({ duration: Number(value) })}
        options={DURATIONS.map(minutes => ({ value: String(minutes), label: durationLabel(t, minutes) }))} />
    </div>}

    {step === 3 && <div className="g-stack">
      <AudiencePicker world={g.world} kinds={AUDIENCE_KINDS} value={draft.audience} onChange={audience => patch({ audience })} label={t("¿Quién lo ve?", "Qui ho veu?")} people={data.profiles} />
      <Tiles label={t("¿Cuántas plazas, contándote a ti?", "Quantes places, comptant-te a tu?")} columns={4} value={String(draft.capacity)} onChange={value => patch({ capacity: Number(value) })}
        options={[2, 3, 4, 5, 6, 7, 8].map(n => ({ value: String(n), label: String(n) }))} />
      <Suggestions label={t("Nota (opcional)", "Nota (opcional)")}
        options={[t("Estoy en la mesa del fondo.", "Estic a la taula del fons."), t("Llevo sudadera verde.", "Duc dessuadora verda."), t("Os espero en la entrada.", "Vos espere a l'entrada.")]}
        onUse={text => patch({ note: text })} />
      <input className="g-input" maxLength={140} placeholder={t("Escribe una nota corta…", "Escriu una nota curta…")} value={draft.note} onChange={event => patch({ note: event.target.value })} />
      <IdentityNote>{t("Se verá con tu nombre y tu foto.", "Es veurà amb el teu nom i la teua foto.")}</IdentityNote>
    </div>}

    <div className="g-actions">
      {step < 3
        ? <Action disabled={!canNext} onClick={() => setStep(step + 1)}>{t("Siguiente", "Següent")}</Action>
        : <Action disabled={g.busy} onClick={() => void submit()}>{t("Abrir hueco", "Obri el forat")}</Action>}
    </div>
  </div>;
}

// ---- Inside the hangout ----

function ActiveView({ g, detail }: { g: Game<State>; detail: HangoutDetail }) {
  const t = g.t;
  const [moving, setMoving] = useState(false);
  const hereText = t("Ya estoy aquí.", "Ja estic ací.");
  const mySeat = detail.seats.find(seat => seat.mine);

  const onSend = async (text: string) => {
    if (text === hereText && mySeat && !mySeat.here) await g.act("here", { id: detail.id });
    return g.act("message", { id: detail.id, text });
  };

  return <div className="g-hangout g-hangout-active">
    <GameHead title={detail.whatLabel} body={`${detail.placeLabel}${detail.note ? " · " + detail.note : ""}`} />

    {detail.closed
      ? <div className="g-error" role="alert"><p>{t("Quien abrió este hueco lo ha cerrado.", "Qui ha obert este forat l'ha tancat.")}</p><Action secondary onClick={() => void g.act("leave", { id: detail.id })}>{t("Salir", "Ixir")}</Action></div>
      : <>
        <Countdown until={detail.started ? detail.expires : detail.starts_at} total={detail.started ? detail.runTotal : detail.waitTotal}
          label={detail.started ? t("Tiempo restante", "Temps restant") : t("Empieza en", "Comença en")} />

        <div className="g-hangout-seats" role="list" aria-label={t("Quién viene", "Qui ve")}>
          {detail.seats.map(seat => <div key={seat.id} className="g-hangout-seat" role="listitem">
            <span className="g-hangout-avatar-wrap"><Avatar person={g.person(seat.id)} />{seat.here && <span className="g-hangout-dot" aria-hidden="true" title={t("Ya está aquí", "Ja està ací")} />}</span>
            <small>{seat.mine ? t("Tú", "Tu") : g.person(seat.id)?.name ?? "—"}</small>
          </div>)}
          {Array.from({ length: detail.spotsLeft }).map((_, index) => <div key={`empty-${index}`} className="g-hangout-seat empty" aria-hidden="true"><span className="g-hangout-avatar-wrap empty-slot" /><small>{t("Libre", "Lliure")}</small></div>)}
        </div>

        <div className="g-actions">
          {mySeat && !mySeat.here && <Action onClick={() => void g.act("here", { id: detail.id })}><CheckCircle2 aria-hidden="true" />{t("Ya estoy aquí", "Ja estic ací")}</Action>}
          {!detail.mine && <Action secondary onClick={() => void g.act("leave", { id: detail.id })}><LogOut aria-hidden="true" />{t("Me tengo que ir", "Me n'haig d'anar")}</Action>}
          {detail.mine && <>
            <Confirm title={t("¿Cerrar este hueco?", "Tanques este forat?")} description={t("Se avisará a quien se haya apuntado.", "S'avisarà qui s'haja apuntat.")} onConfirm={() => g.act("close", { id: detail.id })}>
              <Action secondary>{t("Cerrar", "Tancar")}</Action>
            </Confirm>
            <Action secondary onClick={() => void g.act("extend", { id: detail.id })}>{t("Ampliar media hora", "Ampliar mitja hora")}</Action>
            <Action secondary onClick={() => setMoving(value => !value)}>{t("Cambiar sitio", "Canviar de lloc")}</Action>
          </>}
        </div>

        {moving && <MovePicker g={g} detail={detail} onDone={() => setMoving(false)} />}

        {g.demo && <div className="g-panel-soft g-hangout-demo">
          <p className="g-muted">{t("Botones de demostración: en la app real esto lo haría otra persona.", "Botons de demostració: en l'app real això ho faria una altra persona.")}</p>
          <div className="g-actions">
            <Action secondary onClick={() => void g.act("demoJoin", { id: detail.id })}>{t("Demo: alguien se apunta", "Demo: algú s'apunta")}</Action>
            <Action secondary onClick={() => void g.act("demoMessage", { id: detail.id })}>{t("Demo: escriben en el chat", "Demo: escriuen al xat")}</Action>
            <Action secondary onClick={() => void g.act("demoFinish", { id: detail.id })}>{t("Demo: adelantar al final", "Demo: avançar al final")}</Action>
          </div>
        </div>}

        <Conversation>
          {detail.messages.map(message => <Bubble key={message.id} mine={message.mine} muted={message.system} who={!message.mine && !message.system ? g.person(message.from)?.name : undefined}>{message.text}</Bubble>)}
          {!detail.messages.length && <p className="g-muted">{t("Todavía no hay mensajes.", "Encara no hi ha missatges.")}</p>}
        </Conversation>
        <Composer label={t("Escribe al grupo…", "Escriu al grup…")} busy={g.busy} onSend={onSend}
          quick={[t("Voy de camino.", "Vaig cap allà."), hereText, t("Llego cinco minutos tarde.", "Arribe cinc minuts tard.")]} />
      </>}
  </div>;
}

function MovePicker({ g, detail, onDone }: { g: Game<State>; detail: HangoutDetail; onDone: () => void }) {
  const t = g.t;
  const [place, setPlace] = useState(detail.place);
  const [placeText, setPlaceText] = useState("");
  return <div className="g-panel-soft g-stack">
    <Tiles label={t("Nuevo sitio", "Nou lloc")} columns={3} value={place} onChange={setPlace}
      options={[...Object.keys(PLACE_ICON).filter(id => id !== "otro").map(id => ({ value: id, label: id === "cafeteria" ? t("Cafetería", "Cafeteria") : id === "biblioteca" ? t("Biblioteca", "Biblioteca") : id === "cesped" ? t("El césped", "La gespa") : t("Entrada principal", "Entrada principal"), icon: PLACE_ICON[id] })), { value: "otro", label: t("Otro sitio", "Un altre lloc"), icon: PLACE_ICON.otro }]} />
    {place === "otro" && <input className="g-input" maxLength={60} placeholder={t("¿Dónde?", "On?")} value={placeText} onChange={event => setPlaceText(event.target.value)} />}
    <div className="g-actions">
      <Action disabled={g.busy || !place || (place === "otro" && !placeText.trim())} onClick={async () => { if (await g.act("move", { id: detail.id, place, placeText })) onDone(); }}>{t("Guardar", "Guardar")}</Action>
      <Action secondary onClick={onDone}>{t("Cancelar", "Cancel·lar")}</Action>
    </div>
  </div>;
}

// ---- After the hangout: ¿Repetimos? ----

function RepeatView({ g, repeat }: { g: Game<State>; repeat: RepeatPrompt }) {
  const t = g.t;
  return <div className="g-hangout g-hangout-repeat">
    <GameHead title={t("¿Repetimos?", "Repetim?")} body={t(`${repeat.whatLabel} en ${repeat.placeLabel}. Toca a quien quieras volver a ver.`, `${repeat.whatLabel} a ${repeat.placeLabel}. Toca qui vulgues tornar a veure.`)} />
    <div className="g-hangout-repeat-faces">
      {repeat.others.map(other => <button key={other.id} type="button" className={other.tapped ? "g-hangout-repeat-face on" : "g-hangout-repeat-face"} aria-pressed={other.tapped}
        onClick={() => void g.act("repeatTap", { id: repeat.id, person: other.id })}>
        <Avatar person={g.person(other.id)} />
        <span>{g.person(other.id)?.name ?? "—"}</span>
        {other.mutual && <small><Users2 aria-hidden="true" />{t("Ahora sois contactos", "Ara sou contactes")}</small>}
      </button>)}
      {!repeat.others.length && <p className="g-muted">{t("Esta vez has ido solo o sola.", "Esta vegada has anat sol o sola.")}</p>}
    </div>
    {repeat.canGroup && <div className="g-panel-soft g-row">
      <p>{t("Todos queréis repetir.", "Tots voleu repetir.")}</p>
      <Action onClick={() => g.go("groups")}>{t("Crear grupo", "Crear grup")}</Action>
    </div>}
    <div className="g-actions">
      <Action secondary onClick={() => void g.act("repeatSkip", { id: repeat.id })}>{t("No, gracias", "No, gràcies")}</Action>
      <Action onClick={() => void g.act("repeatDone", { id: repeat.id })}>{t("Listo", "Fet")}</Action>
    </div>
  </div>;
}
