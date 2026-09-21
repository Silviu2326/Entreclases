"use client";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Film, ImagePlus, LockKeyhole, Send, Smile, Sticker, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { communityError } from "@/lib/community/copy";
import { chatMediaTypes } from "@/lib/community/validation";
import type { Message } from "@/lib/community/types";
import { useCommunity } from "./context";
import { Action, Avatar, Empty, IconAction, Loading, Modal } from "./controls";

/* Stickers are ours, not a catalogue's: the things people here actually say, set
   in the same loud type as the rest of Entreclase. A sticker travels as a token
   in the message body, so it needs no storage and no migration. */
const STICKERS = [
  { id: "bajamos", es: "¿Bajamos?", va: "Baixem?", tone: "lime" },
  { id: "cafe", es: "Café. Ya.", va: "Café. Ja.", tone: "peach" },
  { id: "voy", es: "Voy para allá", va: "Vaig cap allà", tone: "lilac" },
  { id: "tarde", es: "Llego tarde 🙈", va: "Arribe tard 🙈", tone: "peach" },
  { id: "jaja", es: "JAJAJA", va: "JAJAJA", tone: "lime" },
  { id: "apuntes", es: "¿Me pasas los apuntes?", va: "Em passes els apunts?", tone: "lilac" },
  { id: "hecho", es: "Hecho.", va: "Fet.", tone: "ink" },
  { id: "examen", es: "Mañana hay examen 💀", va: "Demà hi ha examen 💀", tone: "lilac" },
  { id: "turia", es: "Al Turia.", va: "Al Túria.", tone: "lime" },
  { id: "debo", es: "Te debo una", va: "Te’n dec una", tone: "peach" },
] as const;
const stickerToken = (id: string) => `[[pegatina:${id}]]`;
const stickerOf = (body: string) => { const match = /^\[\[pegatina:([a-z]+)\]\]$/.exec(body.trim()); return match ? STICKERS.find(s => s.id === match[1]) : undefined; };

const EMOJI: { label: [string, string]; icons: string }[] = [
  { label: ["Caras", "Cares"], icons: "😀 😄 😁 😂 🤣 😊 🙂 😉 😍 🥰 😘 😎 🤓 🥳 😇 🤗 🤔 🤪 😅 😬 🙃 😴 🥱 😮 😳 🥺 😢 😭 😤 😡 🤯 😱 🤒 🤩 🤝 🙈" },
  { label: ["Gestos", "Gestos"], icons: "👍 👎 👏 🙌 🙏 💪 👋 🤙 ✌️ 🤞 🤍 👌 🤌 👀 🧠 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 ✨ 🔥 💯 ✅ ❌ ❗ ❓" },
  { label: ["Uni", "Uni"], icons: "📚 📖 📝 ✏️ 🎓 🧪 🧮 💻 ⌨️ 📎 📌 🗓️ ⏰ ☕ 🥐 🍕 🍻 🧃 🚲 🚇 🏛️ 🧑‍🎓 👩‍🏫 💡" },
  { label: ["Planes", "Plans"], icons: "🎉 🎶 🎸 🎬 🍿 ⚽ 🏀 🎾 🏐 🏃 🧗 🏖️ 🌊 🌅 🌳 🚶 🛼 🎮 🎲 📸 🥘 🍊 🌞 🌙" },
];
const RECENT_KEY = "entreclase.emoji";
const readRecent = () => { try { const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); return Array.isArray(saved) ? saved.filter(x => typeof x === "string").slice(0, 16) as string[] : []; } catch { return []; } };

/* One to three emojis on their own are shown big, the way people mean them. */
const isJumbo = (body: string) => /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*\s*){1,3}$/u.test(body.trim());
function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s<>"]+)/g).map((part, index) => index % 2 ? <a key={index} href={part} target="_blank" rel="noopener noreferrer nofollow">{part.replace(/^https?:\/\//, "")}</a> : part);
}

export function Chat({ threadId, peerId }: { threadId: string; peerId: string }) {
  const { c, locale, data, me, repo, run, busy, demo, go } = useCommunity();
  const peer = data.profiles.find(p => p.user_id === peerId);
  const [messages, setMessages] = useState<Message[] | null>(null), [body, setBody] = useState(""), [error, setError] = useState("");
  const [panel, setPanel] = useState<"emoji" | "stickers" | null>(null), [recent, setRecent] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ file: File; url: string } | null>(null), [dragging, setDragging] = useState(false), [zoom, setZoom] = useState<Message | null>(null), [now, setNow] = useState(0);
  const scroll = useRef<HTMLDivElement>(null), picker = useRef<HTMLInputElement>(null), field = useRef<HTMLInputElement>(null), tools = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true), alive = useRef(true), loading = useRef(false), draftUrl = useRef("");

  const load = useCallback(async () => {
    if (loading.current) return; loading.current = true;
    try { const result = await repo.messages(threadId); if (alive.current) { setMessages(result); setNow(Date.now()); setError(""); } }
    catch (e) { if (alive.current) setError(communityError(e, locale)); }
    finally { loading.current = false; }
  }, [repo, threadId, locale]);
  useEffect(() => {
    alive.current = true;
    const poll = () => { if (document.visibilityState === "visible") void load(); };
    const first = window.setTimeout(poll, 0), timer = window.setInterval(poll, 10000);
    document.addEventListener("visibilitychange", poll);
    return () => { alive.current = false; clearTimeout(first); clearInterval(timer); document.removeEventListener("visibilitychange", poll); };
  }, [load]);
  useEffect(() => { if (atBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [messages]);
  useEffect(() => () => { if (draftUrl.current) URL.revokeObjectURL(draftUrl.current); }, []);
  /* The emoji and sticker trays close like any popover: Escape, or a click elsewhere. */
  useEffect(() => {
    if (!panel) return;
    const away = (e: PointerEvent) => { if (!tools.current?.contains(e.target as Node)) setPanel(null); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setPanel(null); field.current?.focus(); } };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", escape); };
  }, [panel]);

  const attach = (file?: File | null) => {
    if (!file) return;
    if (draftUrl.current) URL.revokeObjectURL(draftUrl.current);
    draftUrl.current = URL.createObjectURL(file); setDraft({ file, url: draftUrl.current }); setPanel(null); field.current?.focus();
  };
  const detach = () => { if (draftUrl.current) URL.revokeObjectURL(draftUrl.current); draftUrl.current = ""; setDraft(null); if (picker.current) picker.current.value = ""; };
  const send = async (text: string, file?: File) => {
    if (await run(() => repo.sendMessage(threadId, text, file), "")) {
      if (file) detach();
      if (text === body) setBody("");
      atBottom.current = true; await load();
    }
  };
  const openTray = (next: "emoji" | "stickers") => { if (next === "emoji" && panel !== "emoji") setRecent(readRecent()); setPanel(current => current === next ? null : next); };
  const addEmoji = (icon: string) => {
    const input = field.current, start = input?.selectionStart ?? body.length, end = input?.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + icon + body.slice(end));
    const next = [icon, ...readRecent().filter(x => x !== icon)].slice(0, 16); setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* private mode: recents simply do not persist */ }
    window.setTimeout(() => { input?.focus(); input?.setSelectionRange(start + icon.length, start + icon.length); }, 0);
  };

  const time = new Intl.DateTimeFormat(locale === "va" ? "ca-ES" : "es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date(iso));
  const dayLabel = (iso: string) => {
    /* "Today" is measured from the last time the conversation loaded, which keeps render pure. */
    const key = dayKey(iso), today = dayKey(new Date(now).toISOString()), yesterday = dayKey(new Date(now - 86400000).toISOString());
    return key === today ? c("chatToday") : key === yesterday ? c("chatYesterday") : new Intl.DateTimeFormat(locale === "va" ? "ca-ES" : "es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" }).format(new Date(iso));
  };
  const threadQuote = /^(?:Sobre tu hilo|Sobre el teu fil): «([^»]*)»\n?/;

  return <section className={`u-chat ck-chat ${dragging ? "ck-dragging" : ""}`} aria-label={`${c("conversation")}: ${peer?.name ?? c("student")}`}
    onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
    onDrop={e => { e.preventDefault(); setDragging(false); attach(e.dataTransfer.files[0]); }}>
    <header><IconAction label={c("backChats")} onClick={() => go("messages", { stay: true })}><ArrowLeft /></IconAction><Avatar person={peer} /><div><h2>{peer?.name ?? c("student")}</h2><p>{[peer?.degree, peer?.campus].filter(Boolean).join(" · ")}</p></div><LockKeyhole aria-label={c("privateChat")} /></header>
    <p className="u-chat-privacy">{demo ? c("demoMessages") : c("privateChat")}</p>
    <div className="u-message-scroll" ref={scroll} onScroll={e => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      {messages === null && !error ? <Loading label={c("loading")} /> : messages?.length ? messages.map((m, index) => {
        const previous = messages[index - 1], next = messages[index + 1], own = m.sender_id === me.user_id;
        const newDay = !previous || dayKey(previous.created_at) !== dayKey(m.created_at);
        const close = (a?: Message, b?: Message) => !!a && !!b && a.sender_id === b.sender_id && dayKey(a.created_at) === dayKey(b.created_at) && Math.abs(Date.parse(a.created_at) - Date.parse(b.created_at)) < 300000;
        const joined = !newDay && close(previous, m), last = !close(m, next);
        const sticker = stickerOf(m.body), quoted = threadQuote.exec(m.body), text = quoted ? m.body.slice(quoted[0].length) : m.body, jumbo = !sticker && !m.media_kind && isJumbo(text);
        return <Fragment key={m.id}>
          {newDay && <p className="ck-day"><span>{dayLabel(m.created_at)}</span></p>}
          <article className={`u-message ${own ? "own" : ""} ${joined ? "ck-joined" : ""} ${sticker || jumbo ? "ck-bare" : ""} ${m.media_kind ? "ck-has-media" : ""}`}>
            <span className="sr-only">{own ? me.name : peer?.name}</span>
            {quoted && <blockquote className="ck-quote">{quoted[1]}</blockquote>}
            {m.media_kind === "image" && (m.media_url
              /* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL from a private bucket: not something the image optimiser can fetch */
              ? <button type="button" className="ck-media" aria-label={c("chatOpenPhoto")} onClick={() => setZoom(m)}><img src={m.media_url} alt={c("chatPhoto")} loading="lazy" /></button>
              : <p className="ck-gone">{c("chatMediaGone")}</p>)}
            {m.media_kind === "video" && (m.media_url ? <video className="ck-media" src={m.media_url} controls preload="metadata" playsInline aria-label={c("chatVideo")} /> : <p className="ck-gone">{c("chatMediaGone")}</p>)}
            {sticker ? <p className={`ck-sticker ck-sticker-${sticker.tone}`}>{locale === "va" ? sticker.va : sticker.es}</p> : text && <p className={jumbo ? "ck-jumbo" : undefined}>{jumbo ? text : linkify(text)}</p>}
            {last && <time dateTime={m.created_at}>{time.format(new Date(m.created_at))}</time>}
          </article>
        </Fragment>;
      }) : <Empty title={c("noMessages")} body={c("messagesSub")} />}
    </div>
    {messages && messages.length >= 100 && <p className="u-chat-privacy">{locale === "va" ? "Es mostren els últims 100 missatges." : "Se muestran los últimos 100 mensajes."}</p>}
    {error && <div className="u-chat-error" role="alert"><p>{error}</p><Action secondary onClick={() => void load()}>{c("retry")}</Action></div>}
    {dragging && <p className="ck-drop" aria-hidden="true"><ImagePlus />{c("chatDrop")}</p>}
    <div className="ck-composer" ref={tools}>
      {panel === "emoji" && <div className="ck-tray" role="group" aria-label={c("chatEmoji")}>
        {recent.length > 0 && <><h3>{c("chatRecent")}</h3><div className="ck-emoji-grid">{recent.map(icon => <button type="button" key={icon} onClick={() => addEmoji(icon)}>{icon}</button>)}</div></>}
        {EMOJI.map(group => <Fragment key={group.label[0]}><h3>{group.label[locale === "va" ? 1 : 0]}</h3><div className="ck-emoji-grid">{group.icons.split(" ").map(icon => <button type="button" key={icon} onClick={() => addEmoji(icon)}>{icon}</button>)}</div></Fragment>)}
      </div>}
      {panel === "stickers" && <div className="ck-tray ck-sticker-tray" role="group" aria-label={c("chatStickers")}>
        {STICKERS.map(s => <button type="button" key={s.id} disabled={busy} className={`ck-sticker ck-sticker-${s.tone}`} onClick={() => { setPanel(null); void send(stickerToken(s.id)); }}>{locale === "va" ? s.va : s.es}</button>)}
      </div>}
      {draft && <div className="ck-draft">
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview of the file about to be sent */}
        {draft.file.type.startsWith("video/") ? <span className="ck-draft-video"><Film aria-hidden="true" /></span> : <img src={draft.url} alt="" />}
        <span><strong>{draft.file.name}</strong><small>{(draft.file.size / 1048576).toFixed(1)} MB</small></span>
        <IconAction label={c("chatRemoveFile")} onClick={detach}><X /></IconAction>
      </div>}
      <form className="u-message-form ck-form" onSubmit={e => { e.preventDefault(); if (draft || body.trim()) void send(body, draft?.file); }}>
        <input ref={picker} type="file" accept={chatMediaTypes} hidden onChange={e => attach(e.target.files?.[0])} />
        <IconAction label={c("chatAttach")} onClick={() => picker.current?.click()}><ImagePlus /></IconAction>
        <IconAction label={c("chatEmoji")} aria-expanded={panel === "emoji"} onClick={() => openTray("emoji")}><Smile /></IconAction>
        <IconAction label={c("chatStickers")} aria-expanded={panel === "stickers"} onClick={() => openTray("stickers")}><Sticker /></IconAction>
        <label className="sr-only" htmlFor="chat-message">{c("messagePlaceholder")}</label>
        <Input id="chat-message" ref={field} className="u-input" value={body} onChange={e => setBody(e.target.value)} onPaste={e => { const file = [...e.clipboardData.files].find(f => f.type.startsWith("image/") || f.type.startsWith("video/")); if (file) { e.preventDefault(); attach(file); } }} placeholder={draft ? c("chatCaption") : c("messagePlaceholder")} maxLength={2000} autoComplete="off" />
        <Action type="submit" disabled={busy || (!draft && !body.trim())} aria-label={c("send")}><Send /></Action>
      </form>
    </div>
    <Modal open={!!zoom} onOpenChange={open => { if (!open) setZoom(null); }} title={`${c("chatPhoto")} · ${zoom?.sender_id === me.user_id ? me.name : peer?.name ?? c("student")}`} wide>
      {/* eslint-disable-next-line @next/next/no-img-element -- same signed URL as the thumbnail */}
      {zoom?.media_url && <img className="ck-zoom" src={zoom.media_url} alt={c("chatPhoto")} />}
    </Modal>
  </section>;
}
