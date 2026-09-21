"use client";
import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Dialog } from "radix-ui";
import { ArrowLeft, ArrowRight, Camera, Check, Image as ImageIcon, Loader, Trash2, X } from "lucide-react";
import { campuses, interests, profileInput, relationshipStatuses, type Profile, type RelationshipStatus } from "@/lib/community/types";
import { prepareFace, type FaceKind } from "@/lib/community/images";
import { localName, type CopyKey } from "@/lib/community/copy";
import { useCommunity } from "./context";
import { Action, Avatar, IconAction } from "./controls";

type StepId = "who" | "face" | "where" | "bio" | "likes";
type Draft = { name: string; degree: string; year: number; campus: string; bio: string; relationship_status: RelationshipStatus; interests: string[]; color: number };
const steps: { id: StepId; label: CopyKey; title: CopyKey; help: CopyKey }[] = [
  { id: "who", label: "wizWho", title: "wizWhoTitle", help: "wizWhoHelp" },
  { id: "face", label: "wizFace", title: "wizFaceTitle", help: "wizFaceHelp" },
  { id: "where", label: "wizWhere", title: "wizWhereTitle", help: "wizWhereHelp" },
  { id: "bio", label: "wizBio", title: "wizBioTitle", help: "wizBioHelp" },
  { id: "likes", label: "wizLikes", title: "wizLikesTitle", help: "wizLikesHelp" },
];

const toDraft = (profile: Profile): Draft => ({ name: profile.name, degree: profile.degree, year: profile.year || 1, campus: profile.campus, bio: profile.bio, relationship_status: profile.relationship_status ?? "prefer_not_to_say", interests: profile.interests, color: profile.color });

export function ProfileWizard({ open, onOpenChange, profile }: { open: boolean; onOpenChange: (open: boolean) => void; profile: Profile }) {
  const { c, locale, repo, run, busy, feedback } = useCommunity();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => toDraft(profile));
  const step = steps[index], last = index === steps.length - 1;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(prev => ({ ...prev, [key]: value }));

  // Each step refuses to advance on its own terms, so nothing is rejected at the
  // end by a field three screens back.
  const blocked = (step.id === "who" && (draft.name.trim().length < 2 || draft.degree.trim().length < 2)) || (step.id === "bio" && draft.bio.length > 400);
  const forward = async () => {
    if (blocked) return;
    if (!last) { setIndex(index + 1); return; }
    if (await run(async () => { await repo.saveProfile({ ...profileInput(profile), ...draft, name: draft.name.trim(), degree: draft.degree.trim(), bio: draft.bio.trim() }); }, c("wizSaved"))) onOpenChange(false);
  };
  const close = () => { setIndex(0); setDraft(toDraft(profile)); onOpenChange(false); };

  return <Dialog.Root open={open} onOpenChange={next => { if (!next) close(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="u-overlay u-wiz-overlay"/>
      <Dialog.Content className="u-wiz community-surface" aria-describedby={undefined}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !(event.target as HTMLElement)?.closest("textarea,button,a")) { event.preventDefault(); void forward(); } }}>
        <Dialog.Title className="sr-only">{c("editProfile")}</Dialog.Title>
        <div className="u-wiz-bar" aria-hidden="true"><span style={{ width: `${((index + 1) / steps.length) * 100}%` }}/></div>
        <header className="u-wiz-top">
          <p className="u-wiz-count">{c("wizStep")} <strong>{index + 1}</strong> {c("wizOf")} {steps.length}</p>
          <Dialog.Close asChild><IconAction label={c("wizLeave")}><X/></IconAction></Dialog.Close>
        </header>
        <nav className="u-wiz-rail" aria-label={c("profileSections")}>
          {steps.map((entry, position) => <button type="button" key={entry.id} className={position === index ? "active" : position < index ? "done" : ""} aria-current={position === index ? "step" : undefined} onClick={() => setIndex(position)}>
            <span aria-hidden="true">{position < index ? <Check/> : position + 1}</span>{c(entry.label)}
          </button>)}
        </nav>
        <div className="u-wiz-stage" key={step.id}>
          <p className="u-eyebrow">{c(step.label)}</p>
          <h2>{c(step.title)}</h2>
          <p className="u-wiz-help">{c(step.help)}</p>
          <div className="u-wiz-fields">
            {step.id === "who" && <>
              <WizField label={c("yourName")}><input className="u-wiz-input" value={draft.name} maxLength={60} autoFocus onChange={event => set("name", event.target.value)} placeholder="Álex Torres"/></WizField>
              <WizField label={c("yourDegree")}><input className="u-wiz-input" value={draft.degree} maxLength={100} onChange={event => set("degree", event.target.value)} placeholder={locale === "va" ? "Economia" : "Economía"}/></WizField>
              <WizField label={c("year")}><div className="u-wiz-choices">{[1, 2, 3, 4, 5, 6].map(year => <button type="button" key={year} className={draft.year === year ? "u-wiz-pill active" : "u-wiz-pill"} aria-pressed={draft.year === year} onClick={() => set("year", year)}>{year}º</button>)}</div></WizField>
            </>}
            {step.id === "face" && <FaceStep profile={profile} color={draft.color} onColor={value => set("color", value)}/>}
            {step.id === "where" && <>
              <WizField label={c("yourCampus")}><div className="u-wiz-choices">{campuses.map(campus => <button type="button" key={campus} className={draft.campus === campus ? "u-wiz-pill active" : "u-wiz-pill"} aria-pressed={draft.campus === campus} onClick={() => set("campus", campus)}>{localName(campus, locale)}</button>)}</div></WizField>
              <WizField label={c("relationshipStatus")}><div className="u-wiz-choices">{relationshipStatuses.map(status => <button type="button" key={status} className={draft.relationship_status === status ? "u-wiz-pill active" : "u-wiz-pill"} aria-pressed={draft.relationship_status === status} onClick={() => set("relationship_status", status)}>{c(status)}</button>)}</div></WizField>
            </>}
            {step.id === "bio" && <WizField label={c("biography")}>
              <textarea className="u-wiz-input u-wiz-area" value={draft.bio} maxLength={400} rows={4} autoFocus onChange={event => set("bio", event.target.value)} placeholder={c("composer")}/>
              <p className="u-wiz-counter">{draft.bio.length}/400</p>
            </WizField>}
            {step.id === "likes" && <WizField label={c("interests")}>
              <div className="u-wiz-choices">{interests.map(value => {
                const picked = draft.interests.includes(value), full = draft.interests.length >= 5;
                return <button type="button" key={value} className={picked ? "u-wiz-pill active" : "u-wiz-pill"} aria-pressed={picked} disabled={!picked && full}
                  onClick={() => set("interests", picked ? draft.interests.filter(item => item !== value) : [...draft.interests, value])}>{localName(value, locale)}</button>;
              })}</div>
              <p className="u-wiz-counter">{draft.interests.length}/5</p>
            </WizField>}
          </div>
        </div>
        {feedback?.error && <p className="u-form-notice" role="alert">{feedback.text}</p>}
        <footer className="u-wiz-foot">
          <button type="button" className="u-wiz-back" onClick={() => setIndex(Math.max(0, index - 1))} disabled={!index}><ArrowLeft aria-hidden="true"/>{c("wizBack")}</button>
          <span className="u-wiz-hint" aria-hidden="true">{c("wizEnter")}</span>
          <Action disabled={busy || blocked} onClick={() => void forward()}>{last ? c("wizDone") : c("wizNext")}<ArrowRight/></Action>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function WizField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="u-wiz-field"><span>{label}</span>{children}</label>;
}

function FaceStep({ profile, color, onColor }: { profile: Profile; color: number; onColor: (value: number) => void }) {
  const { c } = useCommunity();
  return <div className="u-wiz-face">
    <div className={`u-wiz-preview u-avatar-${color}`}>
      {profile.banner_url
        ? <Image className="u-wiz-banner" src={profile.banner_url} alt="" width={1280} height={420} unoptimized/>
        : <span className="u-wiz-banner-note" aria-hidden="true">hola. ei. hey.</span>}
      <span className="u-wiz-avatar"><Avatar person={profile} size="large"/></span>
    </div>
    <div className="u-wiz-face-actions">
      <FacePicker kind="banner" label={c("banner")} icon={<ImageIcon/>} current={profile.banner_url}/>
      <FacePicker kind="avatar" label={c("photo")} icon={<Camera/>} current={profile.avatar_url}/>
    </div>
    <p className="u-muted u-small">{c("photoHelp")}</p>
    <WizField label={c("color")}>
      <div className="u-color-field"><div>{[0, 1, 2, 3, 4, 5].map(value => <label key={value} className={`u-avatar-${value} ${color === value ? "selected" : ""}`}>
        <input type="radio" name="wizard-color" value={value} checked={color === value} onChange={() => onColor(value)} aria-label={`${c("color")} ${value + 1}`}/>
        <span aria-hidden="true">{color === value ? "✓" : ""}</span>
      </label>)}</div></div>
    </WizField>
  </div>;
}

function FacePicker({ kind, label, icon, current }: { kind: FaceKind; label: string; icon: ReactNode; current?: string }) {
  const { c, repo, run, busy } = useCommunity();
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const send = async (image: Blob | null) => { setWorking(true); await run(async () => { await repo.saveFace(kind, image); }, ""); setWorking(false); };
  const chosen = async (file?: File) => {
    if (!file) return;
    setWorking(true);
    try { const image = await prepareFace(kind, file); setWorking(false); await send(image); }
    catch (error) { setWorking(false); await run(async () => { throw error; }, ""); }
    if (input.current) input.current.value = "";
  };
  return <div className="u-face-picker">
    <input ref={input} type="file" accept="image/*" className="sr-only" onChange={event => void chosen(event.target.files?.[0])}/>
    <Action secondary type="button" disabled={busy || working} onClick={() => input.current?.click()}>
      {working ? <Loader className="u-spinner" aria-hidden="true"/> : icon}{working ? c("photoWorking") : current ? `${label} · ${c("photoChange")}` : label}
    </Action>
    {current && !working && <IconAction label={`${label} · ${c("photoRemove")}`} onClick={() => void send(null)} disabled={busy}><Trash2/></IconAction>}
  </div>;
}
