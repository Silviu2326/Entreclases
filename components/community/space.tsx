"use client";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, BringToFront, Check, Eye, EyeOff, Minus, Plus, RotateCw, Scissors, Trash2 } from "lucide-react";
import type { Profile, Sticker } from "@/lib/community/types";
import { builtinStickers, builtinStickerUrl, clampPlacement, defaultPlacement, readSpace, spaceBackgrounds, stickerLimits, type BuiltinSticker, type ProfileBlock, type ProfileSpace, type SpaceBackground } from "@/lib/community/space";
import { prepareSticker } from "@/lib/community/cutout";
import { faceTypes } from "@/lib/community/images";
import type { CopyKey } from "@/lib/community/copy";
import { useCommunity } from "./context";
import { Action, Chips, IconAction, Modal } from "./controls";
import "./space.css";

const blockLabel: Record<ProfileBlock, CopyKey> = { showcase: "blockShowcase", network: "blockNetwork", shelf: "blockShelf", picks: "blockPicks", games: "blockGames", achievements: "blockAchievements", credits: "blockCredits", plusone: "blockPlusOne" };
const bgLabel: Record<SpaceBackground, CopyKey> = { papel: "bgPapel", cuaderno: "bgCuaderno", corcho: "bgCorcho", cielo: "bgCielo", turia: "bgTuria", malvarrosa: "bgMalvarrosa", noche: "bgNoche", pizarra: "bgPizarra", lima: "bgLima", terrazo: "bgTerrazo" };
const stickerLabel: Record<BuiltinSticker, CopyKey> = { hola: "stickerHola", cafe: "stickerCafe", planta: "stickerPlanta", corazon: "stickerCorazon", estrella: "stickerEstrella", chincheta: "stickerChincheta", boli: "stickerBoli", sol: "stickerSol" };
const stickerSource = (sticker: Sticker) => sticker.url ?? (sticker.path.startsWith("builtin:") ? builtinStickerUrl(sticker.path.slice(8) as BuiltinSticker) : undefined);

// Stickers pinned on a cover. Positions are percentages of the cover, so a
// sticker lands where its owner left it on any screen. In decorating mode the
// owner drags them and gets a small toolbar on the one they touched.
export function StickerLayer({ profile, active = false }: { profile: Profile; active?: boolean }) {
  const { c, data, repo, run, refresh, busy } = useCommunity();
  const layer = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const stickers = data.stickers.filter(sticker => sticker.owner_id === profile.user_id).sort((a, b) => a.z - b.z || a.created_at.localeCompare(b.created_at));
  const commit = async (sticker: Sticker, patch: Partial<Sticker>) => { if (await run(() => repo.moveSticker(sticker.id, clampPlacement({ x: sticker.x, y: sticker.y, scale: sticker.scale, rotation: sticker.rotation, z: sticker.z, ...patch })), "")) await refresh(); };
  const peel = async (sticker: Sticker) => { if (await run(() => repo.removeSticker(sticker), "")) { setSelected(null); await refresh(); } };
  const percent = (event: ReactPointerEvent) => { const box = layer.current?.getBoundingClientRect(); return box ? { x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 100 } : null; };
  if (!stickers.length && !active) return null;
  return <div ref={layer} className={`sp-layer${active ? " is-active" : ""}${active && selected ? " has-selection" : ""}`} onPointerDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
    {active && <p className="sp-layer-help">{c("decorateHelp")}</p>}
    {stickers.map(sticker => {
      const live = drag?.id === sticker.id ? { ...sticker, x: drag.x, y: drag.y } : sticker, src = stickerSource(sticker);
      if (!src) return null;
      return <div key={sticker.id} className={`sp-sticker${selected === sticker.id ? " is-selected" : ""}${live.y > 62 ? " sp-tools-above" : ""}`}
        style={{ left: `${live.x}%`, top: `${live.y}%`, zIndex: sticker.z + 1, "--sp-scale": sticker.scale, "--sp-rot": `${sticker.rotation}deg` } as CSSProperties}
        onPointerDown={event => { if (!active || busy) return; event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelected(sticker.id); setDrag({ id: sticker.id, x: sticker.x, y: sticker.y, moved: false }); }}
        onPointerMove={event => { if (!drag || drag.id !== sticker.id) return; const at = percent(event); if (at) setDrag({ id: sticker.id, x: Math.min(100, Math.max(0, at.x)), y: Math.min(100, Math.max(0, at.y)), moved: true }); }}
        onPointerUp={() => { if (!drag || drag.id !== sticker.id) return; const done = drag; setDrag(null); if (done.moved) void commit(sticker, { x: done.x, y: done.y }); }}
        onPointerCancel={() => setDrag(null)}>
        <Image src={src} alt="" width={96} height={96} unoptimized draggable={false} />
        {active && selected === sticker.id && <div className="sp-tools" role="toolbar" aria-label={c("spaceStickers")} onPointerDown={event => event.stopPropagation()}>
          <IconAction label={c("stickerSmaller")} disabled={busy} onClick={() => void commit(sticker, { scale: sticker.scale - 0.15 })}><Minus /></IconAction>
          <IconAction label={c("stickerBigger")} disabled={busy} onClick={() => void commit(sticker, { scale: sticker.scale + 0.15 })}><Plus /></IconAction>
          <IconAction label={c("stickerRotate")} disabled={busy} onClick={() => void commit(sticker, { rotation: sticker.rotation + 15 })}><RotateCw /></IconAction>
          <IconAction label={c("stickerFront")} disabled={busy} onClick={() => void commit(sticker, { z: Math.max(0, ...stickers.map(other => other.z)) + 1 })}><BringToFront /></IconAction>
          <IconAction label={c("stickerPeel")} disabled={busy} onClick={() => void peel(sticker)}><Trash2 /></IconAction>
        </div>}
      </div>;
    })}
  </div>;
}

// The panel behind «Personalizar mi espacio»: the blocks and their order, the
// background, and the stickers, shipped or cut out of a picture right here.
export function SpacePanel({ open, onOpenChange, profile }: { open: boolean; onOpenChange: (open: boolean) => void; profile: Profile }) {
  const { c } = useCommunity();
  // The dialog unmounts its content when closed, so the editor below starts
  // from the stored space every time the panel opens.
  return <Modal open={open} onOpenChange={onOpenChange} title={c("customize")} description={c("customizeBody")} wide>
    <SpaceEditor profile={profile} onClose={() => onOpenChange(false)} />
  </Modal>;
}

function SpaceEditor({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { c, data, me, repo, run, refresh, busy, demo } = useCommunity();
  const current = readSpace(profile.space);
  const [tab, setTab] = useState<"blocks" | "background" | "stickers">("blocks");
  const [hidden, setHidden] = useState<ProfileBlock[]>(current.hidden);
  const [order, setOrder] = useState<ProfileBlock[]>(current.order);
  const save = async (space: ProfileSpace) => { const ok = await run(() => repo.saveSpace(space), c("spaceSaved")); if (ok) await refresh(); return ok; };
  const move = (block: ProfileBlock, by: -1 | 1) => setOrder(list => { const from = list.indexOf(block), to = from + by; if (to < 0 || to >= list.length) return list; const next = [...list]; [next[from], next[to]] = [next[to], next[from]]; return next; });
  const toggle = (block: ProfileBlock) => setHidden(list => list.includes(block) ? list.filter(other => other !== block) : [...list, block]);

  const [file, setFile] = useState<File | null>(null);
  const [cutout, setCutout] = useState(true);
  const [tolerance, setTolerance] = useState(32);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [problem, setProblem] = useState("");
  const latest = useRef<string | null>(null);
  const choose = (next: File | null) => { setFile(next); setPreview(null); setProblem(""); };
  // The cut runs in the tab and only after the slider settles: nothing leaves
  // the device until the owner pins the result.
  useEffect(() => {
    if (!file) return;
    let alive = true;
    const timer = setTimeout(async () => {
      try { const blob = await prepareSticker(file, cutout, tolerance); if (!alive) return; setPreview({ blob, url: URL.createObjectURL(blob) }); setProblem(""); }
      catch { if (alive) { setPreview(null); setProblem(c("photoError")); } }
    }, 120);
    return () => { alive = false; clearTimeout(timer); };
  }, [file, cutout, tolerance, c]);
  useEffect(() => { if (latest.current && latest.current !== preview?.url) URL.revokeObjectURL(latest.current); latest.current = preview?.url ?? null; }, [preview]);
  useEffect(() => () => { if (latest.current) URL.revokeObjectURL(latest.current); }, []);
  const mine = data.stickers.filter(sticker => sticker.owner_id === me.user_id);
  const pin = async (source: Blob | BuiltinSticker) => { if (await run(() => repo.addSticker(source, defaultPlacement()), c("stickerPinned"))) { await refresh(); if (typeof source !== "string") choose(null); } };
  const peel = async (sticker: Sticker) => { if (await run(() => repo.removeSticker(sticker), "")) await refresh(); };

  return <>
    <Chips label={c("customize")} value={tab} onChange={value => setTab(value as typeof tab)} options={[{ value: "blocks", label: c("spaceBlocks") }, { value: "background", label: c("spaceBackground") }, { value: "stickers", label: c("spaceStickers") }]} />
    {tab === "blocks" && <div className="sp-section">
      <p className="u-muted u-small">{c("spaceBlocksHelp")}</p>
      <ol className="sp-blocks">{order.map((block, index) => { const off = hidden.includes(block); return <li key={block} className={off ? "is-hidden" : ""}>
        <label><input type="checkbox" checked={!off} onChange={() => toggle(block)} />{off ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}<span>{c(blockLabel[block])}</span><small>{off ? c("blockHidden") : c("blockShown")}</small></label>
        <span className="sp-block-move"><IconAction label={c("blockUp")} disabled={index === 0} onClick={() => move(block, -1)}><ArrowUp /></IconAction><IconAction label={c("blockDown")} disabled={index === order.length - 1} onClick={() => move(block, 1)}><ArrowDown /></IconAction></span>
      </li>; })}</ol>
      <div className="u-form-actions"><Action secondary type="button" disabled={busy} onClick={onClose}>{c("cancel")}</Action><Action disabled={busy} onClick={() => void save({ background: current.background, hidden, order })}>{c("save")}</Action></div>
    </div>}
    {tab === "background" && <div className="sp-section">
      <p className="u-muted u-small">{c("spaceBackgroundHelp")}</p>
      <div className="sp-bgs" role="group" aria-label={c("spaceBackground")}>{spaceBackgrounds.map(background => <button key={background} type="button" className={`sp-bg u-space-${background}${background === current.background ? " is-on" : ""}`} aria-pressed={background === current.background} disabled={busy} onClick={() => void save({ ...current, background })}><span className="sp-bg-name">{c(bgLabel[background])}{background === current.background && <Check aria-hidden="true" />}</span></button>)}</div>
    </div>}
    {tab === "stickers" && <div className="sp-section">
      <p className="u-muted u-small">{c("spaceStickersHelp")} {demo && c("spaceDemoNote")}</p>
      <h3 className="sp-subhead">{c("stickerBuiltin")}</h3>
      <div className="sp-builtins">{builtinStickers.map(name => <button key={name} type="button" className="sp-builtin" disabled={busy || mine.length >= stickerLimits.count} onClick={() => void pin(name)} aria-label={`${c("stickerPin")}: ${c(stickerLabel[name])}`}><Image src={builtinStickerUrl(name)} alt="" width={64} height={64} unoptimized /><span>{c(stickerLabel[name])}</span></button>)}</div>
      <h3 className="sp-subhead">{c("stickerUpload")}</h3>
      <p className="u-muted u-small">{c("stickerUploadHelp")}</p>
      <div className="sp-upload">
        <input type="file" accept={faceTypes.join(",")} onChange={event => choose(event.target.files?.[0] ?? null)} aria-label={c("stickerUpload")} />
        <label className="sp-check"><input type="checkbox" checked={cutout} onChange={event => setCutout(event.target.checked)} /><Scissors aria-hidden="true" />{c("stickerCutout")}</label>
        {cutout && <label className="sp-range"><span>{c("stickerTolerance")}</span><input type="range" min={8} max={90} step={2} value={tolerance} onChange={event => setTolerance(Number(event.target.value))} /></label>}
        {problem && <p className="u-error-text">{problem}</p>}
        {preview && <figure className="sp-preview"><Image src={preview.url} alt={c("stickerPreview")} width={160} height={160} unoptimized /><figcaption>{c("stickerPreview")}</figcaption></figure>}
        <Action disabled={busy || !preview || mine.length >= stickerLimits.count} onClick={() => { if (preview) void pin(preview.blob); }}>{c("stickerPin")}</Action>
      </div>
      <h3 className="sp-subhead">{c("stickerPlaced")} · {mine.length}/{stickerLimits.count}</h3>
      {mine.length ? <ul className="sp-placed">{mine.map(sticker => { const src = stickerSource(sticker); return <li key={sticker.id}>{src && <Image src={src} alt="" width={40} height={40} unoptimized />}<IconAction label={c("stickerPeel")} disabled={busy} onClick={() => void peel(sticker)}><Trash2 /></IconAction></li>; })}</ul> : <p className="u-muted u-small">{c("stickerNone")}</p>}
    </div>}
  </>;
}
