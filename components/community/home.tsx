"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Dices, MapPin, MessageCircle, Plus, Sparkles } from "lucide-react";
import { formatDate, localName, relativeDate } from "@/lib/community/copy";
import { places, type Plan, type Profile, type View } from "@/lib/community/types";
import { useCommunity } from "./context";
import { Action, Avatar } from "./controls";
import { ActivityMap } from "./activity-map";
import { MagazineTeaser } from "./magazine";
import { Feed } from "./feed";
import { Attendance, CreatePlanModal } from "./plans";

const WEEK = 7 * 24 * 60 * 60 * 1000;

type PulseItem = { id: string; date: string; person?: Profile; verb: string; detail?: string; plan?: Plan; view?: View; linkLabel?: string; scrollToForum?: boolean };

export function Home() {
  const { c, locale, data, me, query, go } = useCommunity();
  const [place, setPlace] = useState<string | null>(null);
  const [scope, setScope] = useState<"week" | "all" | "mine">("week");
  const [showAllPulse, setShowAllPulse] = useState(false);
  const [creating, setCreating] = useState(false);

  const upcoming = useMemo(() => data.plans
    .filter(plan => new Date(plan.starts_at).getTime() > Date.now())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [data.plans]);

  const counts = useMemo(() => {
    const total: Record<string, number> = {};
    for (const plan of upcoming) total[plan.place] = (total[plan.place] ?? 0) + 1;
    return total;
  }, [upcoming]);

  const pulse = useMemo<PulseItem[]>(() => {
    const person = (id: string) => data.profiles.find(profile => profile.user_id === id);
    const items: PulseItem[] = [];
    for (const post of data.posts) items.push({ id: `post-${post.id}`, date: post.created_at, person: person(post.author_id), verb: c("pulseThread"), detail: post.body, linkLabel: c("goForum"), scrollToForum: true });
    for (const comment of data.comments) items.push({ id: `comment-${comment.id}`, date: comment.created_at, person: person(comment.author_id), verb: c("pulseReply"), detail: comment.body, linkLabel: c("goForum"), scrollToForum: true });
    for (const plan of data.plans) items.push({ id: `plan-${plan.id}`, date: plan.created_at, person: person(plan.creator_id), verb: c("pulsePlan"), detail: plan.title, plan });
    for (const note of data.notes) items.push({ id: `note-${note.id}`, date: note.created_at, person: person(note.author_id), verb: `${c("pulseNote")} · ${note.subject}`, detail: note.title, view: "campus", linkLabel: c("campus") });
    for (const profile of data.profiles) if (profile.user_id !== me.user_id) items.push({ id: `join-${profile.user_id}`, date: profile.created_at, person: profile, verb: c("pulseJoin"), detail: `${profile.degree} · ${localName(profile.campus, locale)}`, view: "people", linkLabel: c("sayHiShort") });
    return items.filter(item => item.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }, [data, me.user_id, locale, c]);
  const visiblePulse = showAllPulse ? pulse : pulse.slice(0, 4);

  const weekPlans = upcoming.filter(plan => new Date(plan.starts_at).getTime() < Date.now() + WEEK);
  const mine = (id: string) => data.planMembers.some(member => member.plan_id === id && member.user_id === me.user_id);
  const listed = (scope === "mine" ? upcoming.filter(plan => mine(plan.id)) : scope === "week" ? weekPlans : upcoming)
    .filter(plan => !place || plan.place === place);

  const newcomers = data.profiles.filter(profile => profile.user_id !== me.user_id).slice(0, 4);
  const hour = new Date().getHours();
  const greeting = c(hour < 13 ? "greetMorning" : hour < 20 ? "greetAfternoon" : "greetEvening");
  const firstName = me.name.split(/\s+/)[0];

  if (query) return <Feed />;

  return <div className="u-home">
    <section className="u-home-top">
      <div className="u-home-top-copy">
        <p className="u-eyebrow">{greeting}, {firstName} · València</p>
        <h2>{c("homeHeroLine")}</h2>
        <p className="u-home-top-stats">{data.profiles.length} {c("homeStatsPeople")} · {weekPlans.length} {c("homeStatsPlans")} · {data.groups.length} {c("homeStatsGroups")}</p>
      </div>
      <div className="u-home-pills" role="group" aria-label={c("quickActions")}>
        <Action onClick={() => setCreating(true)}><Plus />{c("createPlan")}</Action>
        <button type="button" className="u-pill" onClick={() => focusComposer()}><MessageCircle aria-hidden="true" />{c("quickThread")}</button>
        <button type="button" className="u-pill" onClick={() => go("campus")}><BookOpen aria-hidden="true" />{c("quickNotes")}</button>
        <button type="button" className="u-pill" onClick={() => go("groups")}><Sparkles aria-hidden="true" />{c("quickGroup")}</button>
        <button type="button" className="u-pill" onClick={() => go("explore")}><Dices aria-hidden="true" />{c("quickGames")}</button>
      </div>
      <div className="u-home-top-community">
        <div><Sparkles aria-hidden="true" /><span><strong>{data.groups.length} {c("homeStatsGroups")}</strong><small>{locale === "va" ? "Tria un grup i entra en la conversa." : "Elige un grupo y entra en la conversación."}</small></span></div>
        <div className="u-home-top-groups">{data.groups.slice(0, 3).map(group => <button type="button" key={group.id} onClick={() => go("groups", { groupId: group.id })}>{group.name}<ArrowUpRight aria-hidden="true" /></button>)}</div>
      </div>
    </section>

    <section className="u-home-forum u-home-forum-top" id="u-home-forum" aria-label={c("forumSection")}>
      <Feed compact home />
    </section>

    <section className="u-pulse" aria-label={c("pulse")}>
      <div className="u-home-section-heading">
        <div><p className="u-eyebrow">{c("pulseNow")}</p><h2>{c("pulse")}</h2></div>
      </div>
      <div className="u-pulse-list">
        {pulse.length ? visiblePulse.map(item => <article className="u-pulse-item" key={item.id}>
          <Avatar person={item.person} />
          <div className="u-pulse-body">
            <p className="u-pulse-line"><strong>{item.person?.name ?? c("student")}</strong> {item.verb} <time dateTime={item.date}>{relativeDate(item.date, locale)}</time></p>
            {item.detail && <p className="u-pulse-detail">{item.detail}</p>}
            {item.plan && <div className="u-pulse-plan">
              <span><CalendarDays aria-hidden="true" />{formatDate(item.plan.starts_at, locale)}<MapPin aria-hidden="true" />{localName(item.plan.place, locale)}</span>
              <Attendance plan={item.plan} />
            </div>}
            {!item.plan && item.linkLabel && <button type="button" className="u-text-link" onClick={() => item.scrollToForum ? focusComposer(false) : go(item.view ?? "home")}>{item.linkLabel}<ArrowUpRight aria-hidden="true" /></button>}
          </div>
        </article>) : <p className="u-pulse-empty">{c("pulseEmpty")}</p>}
      </div>
      {pulse.length > 4 && <button type="button" className="u-pulse-more" onClick={() => setShowAllPulse(value => !value)}>{showAllPulse ? c("showLess") : c("seeMore")}<ArrowRight aria-hidden="true" /></button>}
    </section>

    <section className="u-home-map" aria-label={c("mapTitle")}>
      <ActivityMap selected={place} onSelect={setPlace} counts={counts} />

      <div className="u-activity">
        <div className="u-activity-head">
          <div>
            <p className="u-eyebrow">{place ? c("activityHere") : c("activityAll")}</p>
            <h2>{place ? localName(place, locale) : c("activityTitle")}</h2>
          </div>
          <button type="button" className="u-text-link" onClick={() => go("plans")}>{c("seeAll")}<ArrowUpRight aria-hidden="true" /></button>
        </div>

        <div className="u-activity-tabs" role="group" aria-label={c("plans")}>
          {([["week", c("thisWeek")], ["all", c("upcoming")], ["mine", c("myPlans")]] as const).map(([key, label]) =>
            <button key={key} type="button" className={scope === key ? "active" : ""} aria-pressed={scope === key} onClick={() => setScope(key)}>{label}</button>)}
        </div>

        <div className="u-activity-list">
          {listed.length ? listed.slice(0, 6).map(plan => <ActivityRow key={plan.id} plan={plan} />) : <div className="u-activity-empty">
            <MapPin aria-hidden="true" />
            <strong>{c("noActivityHere")}</strong>
            <p>{c("noActivityHereBody")}</p>
            <Action secondary onClick={() => setCreating(true)}><Plus />{c("planHere")}</Action>
          </div>}
        </div>

        {place && <a className="u-activity-directions" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.replace(" · ", " ") + ", Valencia")}`} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden="true" />{c("openMaps")}<ArrowUpRight aria-hidden="true" /></a>}
      </div>
    </section>

    <MagazineTeaser />
    <section className="u-home-people" aria-label={c("newPeople")}>
      <div className="u-home-section-heading">
        <div><p className="u-eyebrow">{c("people")}</p><h2>{c("newPeople")}</h2></div>
        <button type="button" className="u-text-link" onClick={() => go("people")}>{c("seeAll")}<ArrowUpRight aria-hidden="true" /></button>
      </div>
      <div className="u-people-strip">
        {newcomers.map(profile => <button key={profile.user_id} type="button" className="u-people-chip" onClick={() => go("people")}>
          <div className="u-people-chip-head">
            <Avatar person={profile} />
            <span><strong>{profile.name}</strong><small>{profile.degree} · {localName(profile.campus, locale)}</small></span>
          </div>
          {profile.bio && <p className="u-people-chip-bio">{profile.bio}</p>}
          {profile.interests.length > 0 && <span className="u-people-chip-tags">{profile.interests.slice(0, 3).map(interest => <em key={interest}>{localName(interest, locale)}</em>)}</span>}
          <span className="u-people-chip-cta">{c("sayHiShort")}<ArrowRight aria-hidden="true" /></span>
        </button>)}
      </div>
    </section>

    <CreatePlanModal open={creating} onOpenChange={setCreating} defaultPlace={place ?? undefined} />
  </div>;
}

function focusComposer(withFocus = true) {
  const composer = document.querySelector<HTMLTextAreaElement>("#u-home-forum textarea");
  if (!composer) return;
  const top = composer.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2;
  window.scrollTo({ top: Math.max(0, top) });
  if (withFocus) composer.focus({ preventScroll: true });
}

function ActivityRow({ plan }: { plan: Plan }) {
  const { c, locale, data, go } = useCommunity();
  const members = data.planMembers.filter(member => member.plan_id === plan.id);
  const free = Math.max(0, plan.capacity - members.length);
  const tone = Math.max(0, places.indexOf(plan.place as typeof places[number]));
  return <article className={`u-activity-row u-activity-tone-${tone % 5}`}>
    <div className="u-activity-when">
      <CalendarDays aria-hidden="true" />
      <time dateTime={plan.starts_at}>{formatDate(plan.starts_at, locale)}</time>
    </div>
    <h3>{plan.title}</h3>
    <p className="u-activity-where"><MapPin aria-hidden="true" />{localName(plan.place, locale)} · {plan.meeting_point}</p>
    <div className="u-activity-foot">
      <div className="u-activity-people">
        <div className="u-avatar-stack">{members.slice(0, 4).map(member => <Avatar key={member.user_id} size="small" person={data.profiles.find(profile => profile.user_id === member.user_id)} />)}</div>
        <span>{free} {c("placesLeft")}</span>
      </div>
      <div className="u-activity-cta">
        <Attendance plan={plan} />
        <button type="button" className="u-text-link" onClick={() => go("plans")}>{c("planDetails")}<ArrowUpRight aria-hidden="true" /></button>
      </div>
    </div>
  </article>;
}
