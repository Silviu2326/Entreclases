"use client";
import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Check, ExternalLink, FileText, Image as ImageIcon, Link2, Lock, MessageCircle, Play, Plus, School, StickyNote, Trash2, UserRoundCheck, Users } from "lucide-react";
import type { Profile, ShowcaseItem, ShowcaseInput } from "@/lib/community/types";
import { linkHost, showcaseAudiences, showcaseFrames, showcaseKinds, showcaseLimits, youtubeEmbed, youtubeId, youtubeThumbnail, type ShowcaseAudience, type ShowcaseFrame, type ShowcaseKind } from "@/lib/community/showcase";
import { chatMediaTypes } from "@/lib/community/validation";
import type { CopyKey } from "@/lib/community/copy";
import { useCommunity } from "./context";
import { Action, Avatar, Confirm, IconAction, Modal, SelectField, TextArea, TextField } from "./controls";
import "./showcase.css";

const frameLabel: Record<ShowcaseFrame, CopyKey> = { madera: "frameMadera", cristal: "frameCristal", neon: "frameNeon" };
const frameHelp: Record<ShowcaseFrame, CopyKey> = { madera: "frameMaderaHelp", cristal: "frameCristalHelp", neon: "frameNeonHelp" };
const kindLabel: Record<ShowcaseKind, CopyKey> = { link: "kindLink", note: "kindNote", story: "kindStory", media: "kindMedia", file: "kindFile" };
const kindHelp: Record<ShowcaseKind, CopyKey> = { link: "kindLinkHelp", note: "kindNoteHelp", story: "kindStoryHelp", media: "kindMediaHelp", file: "kindFileHelp" };
const kindIcon = { link: Link2, note: StickyNote, story: ImageIcon, media: ImageIcon, file: FileText } as const;
const audienceLabel: Record<ShowcaseAudience, CopyKey> = { everyone: "audienceEveryone", campus: "audienceCampus", contacts: "audienceContacts", chosen: "audienceChosen", only_me: "audienceOnlyMe" };
const audienceHelp: Record<ShowcaseAudience, CopyKey> = { everyone: "audienceEveryoneHelp", campus: "audienceCampusHelp", contacts: "audienceContactsHelp", chosen: "audienceChosenHelp", only_me: "audienceOnlyMeHelp" };
const audienceIcon = { everyone: Users, campus: School, contacts: MessageCircle, chosen: UserRoundCheck, only_me: Lock } as const;
const needsFile = (kind: ShowcaseKind) => kind === "story" || kind === "media" || kind === "file";

// The wall of a profile, drawn as a shop window: a frame, a pane, and shelves
// the pieces stand on. The owner picks the finish and the audience of every
// piece; a visitor only ever receives the pieces the database let through.
export function Showcase({ profile, editable = false }: { profile: Profile; editable?: boolean }) {
  const { c, data, repo, run, refresh, busy, demo } = useCommunity();
  const frame: ShowcaseFrame = profile.showcase_frame ?? "madera";
  const pieces = data.showcase.filter(piece => piece.owner_id === profile.user_id).sort((a, b) => a.position - b.position || b.created_at.localeCompare(a.created_at));
  const [adding, setAdding] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [reading, setReading] = useState<ShowcaseItem | null>(null);
  const [choosing, setChoosing] = useState<{ piece: ShowcaseItem; viewers: string[] } | null>(null);
  const after = async (pending: Promise<boolean>) => { const ok = await pending; if (ok) await refresh(); return ok; };
  const pickFrame = (next: ShowcaseFrame) => after(run(() => repo.saveShowcaseFrame(next), c("showcaseFrameSaved")));
  const setAudience = (piece: ShowcaseItem, audience: ShowcaseAudience) => {
    if (audience === "chosen") { setChoosing({ piece, viewers: piece.viewers }); return; }
    void after(run(() => repo.updateShowcaseItem(piece.id, { audience, viewers: [] }), c("done")));
  };
  const openFile = (piece: ShowcaseItem) => run(async () => {
    const url = await repo.openShowcaseFile(piece);
    const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; a.click();
  });
  return <section className={`u-card sc sc-${frame}`} aria-labelledby={`showcase-${profile.user_id}`}>
    <div className="sc-head">
      <div><p className="u-eyebrow">{c("showcase")}</p><h2 id={`showcase-${profile.user_id}`}>{editable ? c("showcaseTitle") : c("showcaseTitleOther")}</h2><p className="u-muted">{editable ? c("showcaseBody") : c("showcaseBodyOther")}</p></div>
      {editable && <Action onClick={() => setAdding(true)} disabled={busy}><Plus />{c("showcaseAddShort")}</Action>}
    </div>
    {editable && <div className="sc-frames" role="group" aria-label={c("showcaseFrame")}>
      {showcaseFrames.map(option => <button key={option} type="button" className={`sc-swatch sc-swatch-${option}${option === frame ? " is-on" : ""}`} aria-pressed={option === frame} disabled={busy} onClick={() => void pickFrame(option)}>
        <span className="sc-swatch-chip" aria-hidden="true" /><span><strong>{c(frameLabel[option])}</strong><small>{c(frameHelp[option])}</small></span>
      </button>)}
    </div>}
    <div className="sc-window">
      <div className="sc-awning" aria-hidden="true" />
      <div className="sc-glass" aria-hidden="true" />
      {pieces.length ? <ul className="sc-shelves">{pieces.map((piece, index) => {
        const Kind = kindIcon[piece.kind], Audience = audienceIcon[piece.audience], video = piece.kind === "link" && piece.url ? youtubeId(piece.url) : null;
        return <li key={piece.id} className={`sc-piece sc-piece-${piece.kind}${index % 2 ? " sc-piece-odd" : ""}`}>
          <span className="sc-tag"><Kind aria-hidden="true" />{c(kindLabel[piece.kind])}{editable && <Audience aria-label={c(audienceLabel[piece.audience])} className="sc-tag-audience" />}</span>
          <div className="sc-piece-card">
            {piece.kind === "link" && video && <div className="sc-video">{playing === piece.id
              ? <iframe src={youtubeEmbed(video)} title={piece.title || "YouTube"} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
              : <button type="button" className="sc-play" onClick={() => setPlaying(piece.id)} aria-label={`${c("showcasePlay")}: ${piece.title || "YouTube"}`}><Image src={youtubeThumbnail(video)} alt="" width={480} height={360} unoptimized /><span className="sc-play-badge"><span><Play aria-hidden="true" /></span></span></button>}
            </div>}
            {piece.kind === "link" && video && (piece.title || piece.body) && <div className="sc-caption">{piece.title && <strong>{piece.title}</strong>}{piece.body && <p>{piece.body}</p>}</div>}
            {piece.kind === "link" && !video && piece.url && <a className="sc-link" href={piece.url} target="_blank" rel="noopener noreferrer"><span className="sc-link-host"><Link2 aria-hidden="true" />{linkHost(piece.url)}</span><strong>{piece.title || piece.url}</strong>{piece.body && <p>{piece.body}</p>}<span className="sc-link-open"><ExternalLink aria-hidden="true" />{c("showcaseOpen")}</span></a>}
            {piece.kind === "note" && <button type="button" className="sc-note" onClick={() => setReading(piece)}><span className="sc-pin" aria-hidden="true" />{piece.title && <strong>{piece.title}</strong>}<p>{piece.body}</p></button>}
            {(piece.kind === "story" || piece.kind === "media") && <figure className={piece.kind === "story" ? "sc-story" : "sc-media"}>
              {piece.media_url ? (piece.media_kind === "video" ? <video src={piece.media_url} controls preload="none" playsInline /> : <Image src={piece.media_url} alt={piece.title} width={piece.kind === "story" ? 540 : 720} height={piece.kind === "story" ? 960 : 540} unoptimized />) : <span className="sc-media-missing" aria-hidden="true"><ImageIcon /></span>}
              {(piece.title || piece.body) && <figcaption>{piece.title && <strong>{piece.title}</strong>}{piece.body && <span>{piece.body}</span>}</figcaption>}
            </figure>}
            {piece.kind === "file" && <div className="sc-file"><FileText aria-hidden="true" /><div><strong>{piece.title || "PDF"}</strong>{piece.body && <p>{piece.body}</p>}</div><Action secondary disabled={busy} onClick={() => void openFile(piece)}>{c("showcaseOpenFile")}</Action></div>}
            {editable && <div className="sc-piece-tools">
              <select aria-label={c("showcaseWho")} value={piece.audience} disabled={busy} onChange={event => setAudience(piece, event.target.value as ShowcaseAudience)}>{showcaseAudiences.map(option => <option key={option} value={option}>{c(audienceLabel[option])}</option>)}</select>
              {piece.audience === "chosen" && <IconAction label={c("showcaseChoosePeople")} disabled={busy} onClick={() => setChoosing({ piece, viewers: piece.viewers })}><UserRoundCheck /></IconAction>}
              <Confirm title={c("showcaseRemoveTitle")} description={c("showcaseRemoveBody")} onConfirm={() => after(run(() => repo.removeShowcaseItem(piece)))}><IconAction label={c("showcaseRemove")} disabled={busy}><Trash2 /></IconAction></Confirm>
            </div>}
          </div>
        </li>;
      })}</ul> : <div className="sc-empty"><StickyNote aria-hidden="true" /><h3>{editable ? c("showcaseEmpty") : c("showcaseEmptyOther")}</h3>{editable && <p>{c("showcaseEmptyBody")}</p>}</div>}
      <div className="sc-sill" aria-hidden="true" />
    </div>
    {editable && <p className="u-muted u-small sc-foot">{demo ? c("showcaseDemoNote") : c("showcaseYoutubeNote")}</p>}
    <Modal open={!!reading} onOpenChange={open => { if (!open) setReading(null); }} title={reading?.title || c("kindNote")}>{reading && <p className="sc-note-full">{reading.body}</p>}</Modal>
    {editable && <AddPiece open={adding} onOpenChange={setAdding} onSaved={() => after(Promise.resolve(true))} />}
    {editable && <Modal open={!!choosing} onOpenChange={open => { if (!open) setChoosing(null); }} title={c("audienceChosen")} description={c("audienceChosenHelp")}>
      {choosing && <form className="u-form" onSubmit={async event => { event.preventDefault(); if (await after(run(() => repo.updateShowcaseItem(choosing.piece.id, { audience: "chosen", viewers: choosing.viewers }), c("done")))) setChoosing(null); }}>
        <PeoplePicker viewers={choosing.viewers} onChange={viewers => setChoosing({ ...choosing, viewers })} />
        <div className="u-form-actions"><Action secondary type="button" disabled={busy} onClick={() => setChoosing(null)}>{c("cancel")}</Action><Action type="submit" disabled={busy || !choosing.viewers.length}>{c("save")}</Action></div>
      </form>}
    </Modal>}
  </section>;
}

function PeoplePicker({ viewers, onChange }: { viewers: string[]; onChange: (viewers: string[]) => void }) {
  const { c, data, me } = useCommunity();
  const people = data.profiles.filter(person => person.user_id !== me.user_id);
  const toggle = (id: string) => onChange(viewers.includes(id) ? viewers.filter(value => value !== id) : viewers.length < showcaseLimits.viewers ? [...viewers, id] : viewers);
  return <fieldset className="sc-people"><legend>{c("showcaseChoosePeople")}</legend>
    {people.length ? <div className="sc-people-list">{people.map(person => { const on = viewers.includes(person.user_id); return <label key={person.user_id} className={on ? "is-on" : ""}><input type="checkbox" checked={on} onChange={() => toggle(person.user_id)} /><Avatar person={person} size="small" /><span><strong>{person.name}</strong><small>{person.degree}</small></span>{on && <Check aria-hidden="true" />}</label>; })}</div> : <p className="u-muted">{c("showcaseNoPeople")}</p>}
    <p className="u-muted u-small">{viewers.length} {c("showcaseChosenCount")}</p>
  </fieldset>;
}

function AddPiece({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => Promise<boolean> }) {
  const { c, repo, run, busy } = useCommunity();
  const [kind, setKind] = useState<ShowcaseKind>("link");
  const [audience, setAudience] = useState<ShowcaseAudience>("everyone");
  const [viewers, setViewers] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const Kind = kindIcon[kind];
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: ShowcaseInput = { kind, title: String(form.get("title") ?? "").trim(), body: String(form.get("body") ?? "").trim(), url: kind === "link" ? String(form.get("url") ?? "").trim() : undefined, audience, viewers: audience === "chosen" ? viewers : [] };
    if (await run(() => repo.addShowcaseItem(input, needsFile(kind) ? file ?? undefined : undefined), c("showcaseAdded"))) { await onSaved(); onOpenChange(false); setFile(null); setViewers([]); }
  };
  return <Modal open={open} onOpenChange={onOpenChange} title={c("showcaseAdd")} description={c("showcaseBody")} wide>
    <form className="u-form" onSubmit={submit}>
      <div className="sc-kinds" role="group" aria-label={c("showcaseKind")}>{showcaseKinds.map(option => { const Icon = kindIcon[option]; return <button key={option} type="button" className={option === kind ? "sc-kind is-on" : "sc-kind"} aria-pressed={option === kind} onClick={() => { setKind(option); setFile(null); }}><Icon aria-hidden="true" />{c(kindLabel[option])}</button>; })}</div>
      <p className="u-muted u-small sc-kind-help"><Kind aria-hidden="true" />{c(kindHelp[kind])}</p>
      {kind === "link" && <TextField label={c("showcaseUrl")} name="url" type="url" inputMode="url" required placeholder={c("showcaseUrlPlaceholder")} maxLength={showcaseLimits.url} />}
      <TextField label={c("showcaseTitleField")} name="title" maxLength={showcaseLimits.title} required={kind === "file"} />
      {kind === "note" ? <TextArea label={c("showcaseBodyField")} name="body" rows={5} required maxLength={showcaseLimits.body} placeholder={c("showcaseNotePlaceholder")} /> : <TextArea label={c("showcaseCaption")} name="body" rows={2} maxLength={showcaseLimits.body} />}
      {needsFile(kind) && <label className="u-field sc-file-field"><span>{c("showcaseFile")}</span><input type="file" required accept={kind === "file" ? "application/pdf,.pdf" : chatMediaTypes} onChange={event => setFile(event.target.files?.[0] ?? null)} />{file && <small className="u-muted">{file.name}</small>}</label>}
      <SelectField label={c("showcaseWho")} value={audience} onChange={event => setAudience(event.target.value as ShowcaseAudience)}>{showcaseAudiences.map(option => <option key={option} value={option}>{c(audienceLabel[option])}</option>)}</SelectField>
      <p className="u-muted u-small">{c(audienceHelp[audience])}</p>
      {audience === "chosen" && <PeoplePicker viewers={viewers} onChange={setViewers} />}
      <div className="u-form-actions"><Action secondary type="button" disabled={busy} onClick={() => onOpenChange(false)}>{c("cancel")}</Action><Action type="submit" disabled={busy || (audience === "chosen" && !viewers.length)}>{busy ? c("publishing") : c("showcaseAddShort")}</Action></div>
    </form>
  </Modal>;
}
