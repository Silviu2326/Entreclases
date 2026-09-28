"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, BadgeCheck, CalendarPlus, Check, Clock, GraduationCap, Heart, Lock, MapPin, MessageCircle, Sparkles, UserPlus, UserRoundCheck, Users, UsersRound, X } from "lucide-react";
import { campuses, interests, relationshipStatuses, type Plan, type Profile, type RelationshipStatus } from "@/lib/community/types";
import { friendIds, friendState, incomingRequests } from "@/lib/community/friends";
import { formatDate, localName, type CopyKey } from "@/lib/community/copy";
import { orderedBlocks, readSpace, visitorBlocks } from "@/lib/community/space";
import { useClock } from "@/lib/community/use-clock";
import { useCommunity, matches } from "./context";
import { Action, Avatar, Confirm, Empty, IconAction, Modal } from "./controls";
import { CommonBadge, CommonGround, QuickPicks, TasteShelf } from "./profile-tastes";
import { PersonGames } from "./profile-games";
import { Showcase } from "./showcase";
import { StickerLayer } from "./space";
import { Attendance } from "./plans";
import { PickSelect } from "./plan-pickers";
import "./people.css";

const relationshipLabel = (c: (key: CopyKey) => string, status?: RelationshipStatus) => c(status ?? "prefer_not_to_say");
const firstName = (person: Profile) => person.name.split(/\s+/)[0];
const handle = (person: Profile) => person.name.toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* Gente: la lista o, con ?person=, el perfil de alguien. */
export function People() {
  const { personId } = useCommunity();
  return personId ? <PersonProfile key={personId} id={personId} /> : <PeopleHub />;
}

/* Lo que se puede hacer con alguien desde cualquier sitio de Gente: amistad y mensaje. */
function useSocial() {
  const { locale, repo, run, go } = useCommunity();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const befriend = (person: Profile, on: boolean, message: string) => run(() => repo.setFriend(person.user_id, on), message);
  const talk = async (person: Profile) => { let thread = ""; if (await run(async () => { thread = await repo.openThread(person.user_id); }, "")) go("messages", { threadId: thread }); };
  const open = (person: Profile) => go("people", { personId: person.user_id });
  return { t, befriend, talk, open };
}

function FriendButton({ person, compact = false }: { person: Profile; compact?: boolean }) {
  const { data, me, busy } = useCommunity();
  const { t, befriend } = useSocial();
  const state = friendState(data, me.user_id, person.user_id), name = firstName(person);
  if (state === "received") return <span className="pe-friend-choice">
    <Action disabled={busy} onClick={() => void befriend(person, true, t(`${name} ya está en tu gente.`, `${name} ja està en la teua gent.`))}><Check />{t("Aceptar", "Acceptar")}</Action>
    <Action secondary disabled={busy} onClick={() => void befriend(person, false, "")} aria-label={t(`Rechazar la solicitud de ${name}`, `Rebutjar la sol·licitud de ${name}`)}>{compact ? <X /> : <><X />{t("Ahora no", "Ara no")}</>}</Action>
  </span>;
  if (state === "friends") return <Confirm title={t(`¿Quitar a ${name} de tu gente?`, `Llevar ${name} de la teua gent?`)} description={t("Dejaréis de ver lo que compartís solo con vuestra gente. Podéis volver a añadiros cuando queráis.", "Deixareu de vore el que compartiu només amb la vostra gent. Podeu tornar a afegir-vos quan vulgueu.")} onConfirm={() => befriend(person, false, t(`${name} ya no está en tu gente.`, `${name} ja no està en la teua gent.`))}>
    <Action secondary disabled={busy} className="pe-friend-on"><UserRoundCheck /><span className="pe-when-idle">{t("En tu gente", "En la teua gent")}</span><span className="pe-when-hover">{t("Quitar", "Llevar")}</span></Action>
  </Confirm>;
  if (state === "sent") return <Confirm title={t("¿Cancelar la solicitud?", "Cancel·lar la sol·licitud?")} description={t(`${name} todavía no la ha aceptado.`, `${name} encara no l’ha acceptada.`)} onConfirm={() => befriend(person, false, t("Solicitud cancelada.", "Sol·licitud cancel·lada."))}>
    <Action secondary disabled={busy} className="pe-friend-sent"><Clock />{t("Solicitud enviada", "Sol·licitud enviada")}</Action>
  </Confirm>;
  return <Action disabled={busy} onClick={() => void befriend(person, true, t(`Solicitud enviada a ${name}.`, `Sol·licitud enviada a ${name}.`))}><UserPlus />{compact ? t("Añadir", "Afegir") : t("Añadir a tu gente", "Afegir a la teua gent")}</Action>;
}

function PeopleHub() {
  const { c, locale, data, me, query } = useCommunity();
  const { t, open, talk } = useSocial();
  const now = useClock();
  const [campus, setCampus] = useState(""), [interest, setInterest] = useState(""), [relationship, setRelationship] = useState("");
  const others = data.profiles.filter(person => person.user_id !== me.user_id);
  const byId = (id: string) => others.find(person => person.user_id === id);
  const requests = incomingRequests(data, me.user_id).map(byId).filter(person => !!person);
  const friends = friendIds(data, me.user_id).map(byId).filter(person => !!person).filter(person => matches(query, person.name, person.degree, person.bio, ...person.interests));
  const fits = (person: Profile) => (!campus || person.campus === campus) && (!interest || person.interests.includes(interest)) && (!relationship || person.relationship_status === relationship) && matches(query, person.name, person.degree, person.bio, ...person.interests);
  const discover = others.filter(person => !["friends", "received"].includes(friendState(data, me.user_id, person.user_id)) && fits(person));
  // El próximo plan al que vais los dos: lo primero que enseña la ficha de un amigo.
  const nextTogether = (person: Profile) => data.plans.filter(plan => Date.parse(plan.starts_at) > now && [me.user_id, person.user_id].every(who => data.planMembers.some(member => member.plan_id === plan.id && member.user_id === who))).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  return <div className="pe-hub">
    {requests.length > 0 && <section className="pe-requests" aria-labelledby="pe-requests-title">
      <header><p className="pe-kicker">{t("TE QUIEREN EN SU GENTE", "ET VOLEN EN LA SEUA GENT")}</p><h2 id="pe-requests-title">{t("Solicitudes", "Sol·licituds")}<span className="pe-count">{requests.length}</span></h2></header>
      <div className="pe-request-list">{requests.map(person => <article key={person.user_id} className="pe-request">
        <button type="button" className="pe-request-who" onClick={() => open(person)}><Avatar person={person} /><span><strong>{person.name}</strong><small>{person.degree} · {localName(person.campus, locale)}</small></span></button>
        <FriendButton person={person} compact />
      </article>)}</div>
    </section>}

    <section className="pe-friends" aria-labelledby="pe-friends-title">
      <header className="pe-section-head"><div><p className="pe-kicker">{t("LOS TUYOS", "ELS TEUS")}</p><h2 id="pe-friends-title">{t("Tu gente", "La teua gent")}<span className="pe-count">{friends.length}</span></h2></div></header>
      {friends.length ? <div className="pe-friend-row">{friends.map(person => { const plan = nextTogether(person); return <article key={person.user_id} className="pe-friend">
        <button type="button" className="pe-friend-open" onClick={() => open(person)} aria-label={t(`Ver el perfil de ${person.name}`, `Vore el perfil de ${person.name}`)}>
          <span className={`pe-friend-cover u-avatar-${person.color}`}>{person.banner_url && <Image src={person.banner_url} alt="" width={420} height={140} unoptimized />}</span>
          <Avatar person={person} size="large" />
          <strong>{person.name}</strong>
          <small>{plan ? <><Sparkles aria-hidden="true" />{t("Plan juntos", "Pla junts")} · {formatDate(plan.starts_at, locale)}</> : <><MapPin aria-hidden="true" />{localName(person.campus, locale)}</>}</small>
        </button>
        <IconAction label={t(`Escribir a ${person.name}`, `Escriure a ${person.name}`)} onClick={() => void talk(person)}><MessageCircle /></IconAction>
      </article>; })}</div> : <div className="pe-friends-empty"><UsersRound aria-hidden="true" /><p>{t("Todavía no has añadido a nadie. Empieza por alguien de aquí abajo: basta con un «Añadir».", "Encara no has afegit ningú. Comença per algú d’ací baix: n’hi ha prou amb un «Afegir».")}</p></div>}
    </section>

    <section className="pe-discover" aria-labelledby="pe-discover-title">
      <header className="pe-section-head"><div><p className="pe-kicker">{t("GENTE NUEVA", "GENT NOVA")}</p><h2 id="pe-discover-title">{t("Por descubrir", "Per descobrir")}</h2></div></header>
      <div className="pe-filters">
        <PickSelect label={c("yourCampus")} icon={MapPin} value={campus} onChange={setCampus} options={[{ value: "", label: c("allCampuses") }, ...campuses.map(value => ({ value, label: localName(value, locale), count: others.filter(person => person.campus === value).length }))]} />
        <PickSelect label={c("interests")} icon={Sparkles} value={interest} onChange={setInterest} options={[{ value: "", label: c("all") }, ...interests.map(value => ({ value, label: localName(value, locale), count: others.filter(person => person.interests.includes(value)).length }))]} />
        <PickSelect label={c("relationshipFilter")} icon={Heart} value={relationship} onChange={setRelationship} options={[{ value: "", label: c("allRelationships") }, ...relationshipStatuses.map(value => ({ value, label: relationshipLabel(c, value) }))]} />
        <span role="status" className="pe-filter-count">{discover.length} {discover.length === 1 ? t("persona", "persona") : t("personas", "persones")}</span>
      </div>
      {discover.length ? <div className="pe-grid">{discover.map(person => <article key={person.user_id} className="pe-card">
        <button type="button" className="pe-card-open" onClick={() => open(person)} aria-label={t(`Ver el perfil de ${person.name}`, `Vore el perfil de ${person.name}`)}>
          <span className={`pe-card-cover u-avatar-${person.color}`}>{person.banner_url && <Image src={person.banner_url} alt="" width={640} height={200} unoptimized />}</span>
          <Avatar person={person} size="large" />
          <strong>{person.name}</strong>
          <small>{person.degree}{person.year > 0 ? ` · ${person.year}º` : ""}</small>
          <span className="pe-card-campus"><MapPin aria-hidden="true" />{localName(person.campus, locale)}</span>
          <p>{person.bio || c("noBio")}</p>
          <span className="pe-tags">{person.interests.slice(0, 3).map(value => <span key={value}>{localName(value, locale)}</span>)}</span>
        </button>
        <CommonBadge other={person} />
        <footer><FriendButton person={person} compact /><IconAction label={t(`Escribir a ${person.name}`, `Escriure a ${person.name}`)} onClick={() => void talk(person)}><MessageCircle /></IconAction></footer>
      </article>)}</div> : <Empty title={c("noPeople")} body={c("emptySearch")} />}
    </section>
  </div>;
}

function PersonProfile({ id }: { id: string }) {
  const { c, locale, data, me, demo, go } = useCommunity();
  const { t, talk } = useSocial();
  const now = useClock();
  const [inviting, setInviting] = useState(false);
  const person = data.profiles.find(profile => profile.user_id === id);
  if (!person || person.user_id === me.user_id) return <div className="pe-profile-missing">
    <BackToPeople />
    <Empty title={person ? t("Este eres tú.", "Este eres tu.") : t("No encontramos a esta persona.", "No trobem esta persona.")} body={person ? t("Tu perfil tiene su propia pantalla.", "El teu perfil té la seua pròpia pantalla.") : t("Puede que haya cerrado su cuenta.", "Potser ha tancat el compte.")} action={person ? <Action onClick={() => go("profile")}>{c("profile")}<ArrowUpRight /></Action> : undefined} />
  </div>;
  const state = friendState(data, me.user_id, person.user_id), friends = state === "friends", name = firstName(person);
  const layout = readSpace(person.space);
  const attends = (plan: Plan, who: string) => data.planMembers.some(member => member.plan_id === plan.id && member.user_id === who);
  const upcoming = data.plans.filter(plan => Date.parse(plan.starts_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const theirPlans = upcoming.filter(plan => attends(plan, person.user_id)), together = theirPlans.filter(plan => attends(plan, me.user_id));
  const groups = data.groups.filter(group => !group.is_private && data.groupMembers.some(member => member.group_id === group.id && member.user_id === person.user_id));
  const posts = data.posts.filter(post => post.author_id === person.user_id).length, created = data.plans.filter(plan => plan.creator_id === person.user_id).length;
  const friendship = data.friendships.find(row => row.status === "accepted" && [row.requester_id, row.addressee_id].includes(person.user_id) && [row.requester_id, row.addressee_id].includes(me.user_id));
  return <div className={`pe-profile u-my-profile u-space u-space-${layout.background}`}>
    <BackToPeople />
    <section className="u-card u-profile pe-profile-card">
      <div className={`u-profile-cover u-avatar-${person.color}${person.banner_url ? " has-photo" : ""}`}>{person.banner_url ? <Image className="u-profile-banner" src={person.banner_url} alt="" width={1280} height={420} unoptimized priority /> : <span aria-hidden="true">hola. ei. hey.</span>}<StickerLayer profile={person} /></div>
      <div className="u-profile-body">
        <div className="u-profile-top"><Avatar person={person} size="large" /><div className="u-profile-top-actions pe-actions">
          <FriendButton person={person} />
          <Action secondary onClick={() => void talk(person)}><MessageCircle />{t("Mensaje", "Missatge")}</Action>
          <Action secondary onClick={() => setInviting(true)}><CalendarPlus />{t("Invitar a un plan", "Convidar a un pla")}</Action>
        </div></div>
        <div className="u-profile-heading"><div><h2>{person.name}{!demo && <BadgeCheck className="u-verified" aria-label={c("verified")} />}</h2><p className="u-profile-handle">@{handle(person)}</p></div><span className="u-profile-campus">{localName(person.campus, locale)}</span></div>
        {state === "received" && <p className="pe-status pe-status-received"><UserPlus aria-hidden="true" />{t(`${name} quiere estar en tu gente.`, `${name} vol estar en la teua gent.`)}</p>}
        {state === "sent" && <p className="pe-status"><Clock aria-hidden="true" />{t(`Esperando a que ${name} acepte tu solicitud.`, `Esperant que ${name} accepte la teua sol·licitud.`)}</p>}
        {friends && <p className="pe-status pe-status-friends"><UserRoundCheck aria-hidden="true" />{t("En tu gente", "En la teua gent")}{friendship?.accepted_at ? ` ${t("desde el", "des del")} ${new Intl.DateTimeFormat(locale === "va" ? "ca-ES" : "es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" }).format(new Date(friendship.accepted_at))}` : ""}</p>}
        <p className="u-muted">{person.university}</p>
        <p className="u-profile-bio">{person.bio || c("noBio")}</p>
        <div className="u-profile-meta"><span><GraduationCap aria-hidden="true" />{person.degree}{person.year > 0 ? ` · ${person.year}º` : ""}</span><span><MapPin aria-hidden="true" />{localName(person.campus, locale)}</span></div>
        <p className="u-relationship-line"><Heart aria-hidden="true" />{relationshipLabel(c, person.relationship_status)}</p>
        {person.interests.length > 0 && <div className="u-tags">{person.interests.map(value => <span key={value}>{localName(value, locale)}</span>)}</div>}
        <div className="u-profile-stats" aria-label={c("profileStats")}><span><strong>{posts}</strong><small>{c("profilePostsCount")}</small></span><span><strong>{created}</strong><small>{c("profilePlansCount")}</small></span><span><strong>{groups.length}</strong><small>{c("profileGroupsCount")}</small></span><span><strong>{theirPlans.length}</strong><small>{t("planes a la vista", "plans a la vista")}</small></span></div>
      </div>
    </section>
    <CommonGround other={person} />
    {friends ? <section className="u-card pe-together" aria-labelledby="pe-together-title">
      <header><p className="u-eyebrow">{t("SOLO PARA SU GENTE", "NOMÉS PER A LA SEUA GENT")}</p><h2 id="pe-together-title">{t(`Los planes de ${name}`, `Els plans de ${name}`)}</h2></header>
      {together.length > 0 && <><h3>{t("Vais juntos", "Aneu junts")}</h3><div className="pe-plan-list">{together.map(plan => <PlanLine key={plan.id} plan={plan} />)}</div></>}
      {theirPlans.filter(plan => !together.includes(plan)).length > 0 && <><h3>{t("Se apunta a", "S’apunta a")}</h3><div className="pe-plan-list">{theirPlans.filter(plan => !together.includes(plan)).map(plan => <PlanLine key={plan.id} plan={plan} />)}</div></>}
      {!theirPlans.length && <p className="pe-together-empty">{t(`${name} no tiene planes a la vista. ¿Y si le invitas tú?`, `${name} no té plans a la vista. I si el convides tu?`)} <button type="button" onClick={() => setInviting(true)}>{t("Invitar a un plan", "Convidar a un pla")}<ArrowUpRight aria-hidden="true" /></button></p>}
      {groups.length > 0 && <><h3>{t("Sus grupos", "Els seus grups")}</h3><div className="pe-groups">{groups.map(group => <button type="button" key={group.id} onClick={() => go("messages", { groupId: group.id })}><Users aria-hidden="true" />{group.name}</button>)}</div></>}
    </section> : <section className="u-card pe-locked" aria-labelledby="pe-locked-title">
      <span className="pe-locked-icon" aria-hidden="true"><Lock /></span>
      <div><h2 id="pe-locked-title">{t(`Lo de ${name}, para su gente`, `El de ${name}, per a la seua gent`)}</h2><p>{t(`Cuando estéis en la gente del otro verás sus planes, sus grupos y lo que comparte solo con sus amigos.`, `Quan estigueu en la gent de l’altre voràs els seus plans, els seus grups i el que compartix només amb els seus amics.`)}</p></div>
      {state === "none" && <FriendButton person={person} />}
    </section>}
    {orderedBlocks(layout, visitorBlocks).map(block => block === "showcase" ? <Showcase key={block} profile={person} /> : block === "shelf" ? <TasteShelf key={block} profile={person} /> : block === "picks" ? <QuickPicks key={block} profile={person} /> : <PersonGames key={block} person={person} />)}
    <InvitePlanModal person={person} open={inviting} onOpenChange={setInviting} />
  </div>;
}

function BackToPeople() {
  const { go, locale } = useCommunity();
  return <button type="button" className="pe-back" onClick={() => go("people")}><ArrowLeft aria-hidden="true" />{locale === "va" ? "Tota la gent" : "Toda la gente"}</button>;
}

function PlanLine({ plan }: { plan: Plan }) {
  const { locale, data, go } = useCommunity();
  const date = new Date(plan.starts_at), dateLocale = locale === "va" ? "ca-ES" : "es-ES", going = data.planMembers.filter(member => member.plan_id === plan.id).length;
  return <article className="pe-plan">
    <time dateTime={plan.starts_at}><strong>{new Intl.DateTimeFormat(dateLocale, { day: "numeric", timeZone: "Europe/Madrid" }).format(date)}</strong><span>{new Intl.DateTimeFormat(dateLocale, { month: "short", timeZone: "Europe/Madrid" }).format(date).replace(".", "")}</span></time>
    <button type="button" className="pe-plan-main" onClick={() => go("explore", { anchor: `plan-${plan.id}` })}><strong>{plan.title}</strong><small><MapPin aria-hidden="true" />{localName(plan.place, locale)} · {formatDate(plan.starts_at, locale)} · {going}/{plan.capacity}</small></button>
    <Attendance plan={plan} />
  </article>;
}

/* Invitar a un plan es un mensaje privado con el plan dentro: llega a la conversación de los dos. */
function InvitePlanModal({ person, open, onOpenChange }: { person: Profile; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { locale, data, me, repo, run, go, busy } = useCommunity();
  const { t } = useSocial();
  const now = useClock();
  const [chosen, setChosen] = useState(""), [note, setNote] = useState("");
  const members = (plan: Plan) => data.planMembers.filter(member => member.plan_id === plan.id);
  const plans = data.plans.filter(plan => Date.parse(plan.starts_at) > now && members(plan).some(member => member.user_id === me.user_id) && !members(plan).some(member => member.user_id === person.user_id) && members(plan).length < plan.capacity).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const selected = plans.find(plan => plan.id === chosen) ?? plans[0];
  const name = firstName(person);
  const send = async () => {
    if (!selected) return;
    const text = `${t("Te invito a mi plan", "T’invite al meu pla")} «${selected.title}» · ${formatDate(selected.starts_at, locale)} · ${localName(selected.place, locale)}. ${note.trim() || t("¿Te apuntas?", "T’apuntes?")}`;
    let thread = "";
    if (await run(async () => { thread = await repo.openThread(person.user_id); await repo.sendMessage(thread, text); }, t(`Invitación enviada a ${name}.`, `Invitació enviada a ${name}.`))) { onOpenChange(false); go("messages", { threadId: thread }); }
  };
  return <Modal open={open} onOpenChange={onOpenChange} title={t(`Invitar a ${name}`, `Convidar ${name}`)} description={t("Le llega por mensaje privado, con el plan dentro.", "Li arriba per missatge privat, amb el pla dins.")}>
    {plans.length ? <div className="pe-invite">
      <fieldset><legend>{t("¿A qué plan?", "A quin pla?")}</legend>{plans.map(plan => <label key={plan.id} className="pe-invite-option"><input type="radio" name="invite-plan" value={plan.id} checked={selected?.id === plan.id} onChange={() => setChosen(plan.id)} /><span><strong>{plan.title}</strong><small>{formatDate(plan.starts_at, locale)} · {localName(plan.place, locale)} · {plan.capacity - members(plan).length} {t("plazas libres", "places lliures")}</small></span><Check className="pe-invite-check" aria-hidden="true" /></label>)}</fieldset>
      <label className="pe-invite-note"><span>{t("Unas palabras (opcional)", "Unes paraules (opcional)")}</span><textarea className="u-input u-textarea" rows={2} maxLength={300} value={note} onChange={event => setNote(event.target.value)} placeholder={t("¿Te apuntas? Vamos unos cuantos de clase.", "T’apuntes? Anem uns quants de classe.")} /></label>
      <Action disabled={busy || !selected} onClick={() => void send()}><CalendarPlus />{t(`Enviar invitación a ${name}`, `Enviar invitació a ${name}`)}</Action>
    </div> : <Empty title={t("No tienes planes con sitio para invitar", "No tens plans amb lloc per a convidar")} body={t(`Monta uno y luego invita a ${name}.`, `Munta’n un i després convida ${name}.`)} action={<Action onClick={() => { onOpenChange(false); go("explore", { anchor: "ex-plans" }); }}>{t("Montar un plan", "Muntar un pla")}<ArrowUpRight /></Action>} />}
  </Modal>;
}

export { FriendButton };
