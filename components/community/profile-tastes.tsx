"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, ChevronDown, Clapperboard, Filter, Gamepad2, Music, Plus, Search, Sparkles, Tv } from "lucide-react";
import { profileInput, type Profile } from "@/lib/community/types";
import { byKind, coverUrl, sameTaste, searchTastes, tasteKinds, tastesPerKind, type Taste, type TasteKind, type TasteSource } from "@/lib/community/tastes";
import { cacheTasteCover, getCachedTasteCover } from "@/lib/community/taste-cache";
import { chosenIn, localePick, pickOptions, pickPairs, type PickOption, type PickPair } from "@/lib/community/picks";
import type { CopyKey } from "@/lib/community/copy";
import { useCommunity } from "./context";
import { Action, Modal, TextField } from "./controls";

const kindIcon = { tv: Tv, film: Clapperboard, game: Gamepad2, music: Music } as const;
const kindTitle: Record<TasteKind, CopyKey> = { tv: "shelfTv", film: "shelfFilm", game: "shelfGame", music: "shelfMusic" };
const kindEmpty: Record<TasteKind, CopyKey> = { tv: "shelfTvEmpty", film: "shelfFilmEmpty", game: "shelfGameEmpty", music: "shelfMusicEmpty" };
// Rotates the tinted blocks so a long list never reads as a grey table.
const tone = (index: number) => ["lime", "peach", "sky"][index % 3];

function Cover({ taste }: { taste: Taste }) {
  const url = coverUrl(taste);
  const [cached, setCached] = useState<{ key: string; url: string }>();
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    if (url) {
      void getCachedTasteCover(taste).then(found => {
        if (!active) {
          if (found) URL.revokeObjectURL(found);
          return;
        }
        if (found) {
          objectUrl = found;
          setCached({ key: url, url: found });
        } else void cacheTasteCover(taste);
      });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [taste, url]);
  const displayUrl = cached && cached.key === url ? cached.url : url;
  return displayUrl
    ? <Image className="u-taste-art" src={displayUrl} alt="" width={78} height={112} unoptimized />
    : <span className={`u-taste-art u-taste-letter u-taste-placeholder u-taste-placeholder-${taste.k}`} aria-hidden="true"><span>{taste.t.slice(0, 2)}</span><small>{taste.k === "tv" ? "SERIE" : taste.k === "film" ? "PELI" : taste.k === "game" ? "GAME" : "DISCO"}</small></span>;
}

function Tile({ taste, shared, onNow }: { taste: Taste; shared: number; onNow?: () => void }) {
  const { c } = useCommunity();
  const body = <><Cover taste={taste}/>{taste.now && <span className="u-taste-now" aria-hidden="true">{c("shelfNow")}</span>}<strong>{taste.t}</strong>{shared > 0 && <small title={`${shared} ${c(shared === 1 ? "shelfSharedOne" : "shelfShared")}`}>+{shared}</small>}</>;
  if (!onNow) return <li className={taste.now ? "u-taste current" : "u-taste"}>{body}</li>;
  return <li className={taste.now ? "u-taste current" : "u-taste"}>
    <button type="button" onClick={onNow} aria-pressed={!!taste.now} title={c("shelfNowHelp")}>{body}</button>
  </li>;
}

export function TasteShelf({ profile, editable = false }: { profile: Profile; editable?: boolean }) {
  const { c, data, repo, run, busy } = useCommunity();
  const [picking, setPicking] = useState<TasteKind | null>(null);
  const others = data.profiles.filter(p => p.user_id !== profile.user_id);
  const sharedWith = (taste: Taste) => others.filter(p => p.favorites.some(other => sameTaste(other, taste))).length;
  const save = (favorites: Taste[]) => run(async () => { await repo.saveProfile({ ...profileInput(profile), favorites }); });
  const toggleNow = (taste: Taste) => void save(profile.favorites.map(item => item.k !== taste.k ? item : sameTaste(item, taste) ? { ...item, now: !item.now } : { ...item, now: false }));
  const total = profile.favorites.length;
  return <details className="u-card u-shelf" aria-labelledby="shelf-title">
    <summary className="u-shelf-summary">
      <div><p className="u-eyebrow">{c("shelf")}</p><h2 id="shelf-title">{editable ? c("shelfTitle") : c("shelfTitleOther")}</h2><p className="u-muted">{editable ? c("shelfBody") : c("shelfBodyOther")}</p></div>
      <span className="u-shelf-summary-side"><span className="u-shelf-note" aria-hidden="true">{total ? c("shelfStamp") : c("shelfStampEmpty")}</span><ChevronDown aria-hidden="true"/></span>
    </summary>
    <div className="u-shelf-detail"><div className="u-shelf-rows">{tasteKinds.map((kind, index) => {
      const items = byKind(profile.favorites, kind), Icon = kindIcon[kind];
      return <div className={`u-shelf-row ${tone(index)}`} key={kind}>
        <p className="u-shelf-row-title"><Icon aria-hidden="true"/>{c(kindTitle[kind])}</p>
        {items.length || editable
          ? <ul className="u-taste-strip">
              {items.map(taste => <Tile key={`${taste.k}:${taste.id}`} taste={taste} shared={sharedWith(taste)} onNow={editable ? () => toggleNow(taste) : undefined}/>)}
              {editable && items.length < tastesPerKind && <li className="u-taste-add"><button type="button" onClick={() => setPicking(kind)} disabled={busy}><Plus aria-hidden="true"/><span>{items.length ? c("shelfAdd") : c(kindEmpty[kind])}</span></button></li>}
            </ul>
          : <p className="u-muted u-small u-shelf-blank">{c("shelfBlank")}</p>}
      </div>;
    })}</div>
    {editable && picking && <TastePicker key={picking} kind={picking} chosen={profile.favorites} onClose={() => setPicking(null)} onSave={favorites => { setPicking(null); void save(favorites); }}/>} 
    </div>
  </details>;
}

// Mounted fresh per shelf row (keyed on the kind), so the draft starts from
// what is already saved without an effect to reset it.
function TastePicker({ kind, chosen, onClose, onSave }: { kind: TasteKind; chosen: Taste[]; onClose: () => void; onSave: (favorites: Taste[]) => void }) {
  const { c } = useCommunity();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TasteFilter>("all");
  const [results, setResults] = useState<Taste[]>([]);
  const [local, setLocal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Taste[]>(chosen);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try { const found = await searchTastes(kind, query, controller.signal); setResults(found.items); setLocal(found.local); }
      catch { /* Superseded by a newer keystroke. */ }
      finally { setLoading(false); }
    }, query ? 320 : 0);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [kind, query]);

  const mine = byKind(draft, kind);
  const has = (taste: Taste) => mine.some(item => sameTaste(item, taste));
  const toggle = (taste: Taste) => setDraft(prev => {
    if (has(taste)) return prev.filter(item => !sameTaste(item, taste));
    if (mine.length >= tastesPerKind) return prev;
    void cacheTasteCover(taste);
    return [...prev, taste];
  });
  const sources = [...new Set(results.map(item => item.source).filter((source): source is TasteSource => !!source))];
  const visibleResults = results.filter(item => matchesTasteFilter(item, filter));
  const shown = [...mine.filter(item => !visibleResults.some(found => sameTaste(found, item))), ...visibleResults];
  return <Modal open onOpenChange={open => { if (!open) onClose(); }} title={c(kindTitle[kind])} description={c("shelfPickerHelp")} wide>
    <div className="u-picker">
      <div className="u-picker-search"><Search aria-hidden="true"/><TextField label={c("shelfSearch")} value={query} onChange={event => setQuery(event.target.value)} placeholder={c("shelfSearch")} autoComplete="off"/><span className="u-picker-count">{mine.length}/{tastesPerKind}</span></div>
      <div className="u-picker-filters"><Filter aria-hidden="true"/><label><span>Filtrar</span><select value={filter} onChange={event => setFilter(event.target.value as TasteFilter)}><option value="all">Todo</option><option value="cover">Con portada</option>{kind !== "music" && <><option value="recent">Más recientes</option><option value="classic">Clásicos</option></>}{sources.map(source => <option key={source} value={`source:${source}`}>{sourceLabel(source)}</option>)}</select></label></div>
      {local && query.trim() !== "" && <p className="u-muted u-small">{c("shelfOffline")}</p>}
      <ul className="u-picker-grid">{shown.map(taste => {
        const selected = has(taste);
        return <li key={`${taste.k}:${taste.id}`}>
          <button type="button" className={selected ? "u-picker-item selected" : "u-picker-item"} aria-pressed={selected} disabled={!selected && mine.length >= tastesPerKind} onClick={() => toggle(taste)}>
            <Cover taste={taste}/>
            <span><strong>{taste.t}</strong>{taste.s && <small>{taste.s}</small>}</span>
            {selected ? <Check aria-hidden="true"/> : <Plus aria-hidden="true"/>}
          </button>
        </li>;
      })}</ul>
      {!shown.length && !loading && <p className="u-muted u-small">{c("shelfNoResults")}</p>}
      <div className="u-form-actions"><Action secondary onClick={onClose}>{c("cancel")}</Action><Action onClick={() => onSave(draft)}>{c("save")}</Action></div>
    </div>
  </Modal>;
}

type TasteFilter = "all" | "cover" | "recent" | "classic" | `source:${TasteSource}`;

const sourceLabel = (source: TasteSource) => ({ tmdb: "TMDB", omdb: "OMDb", tvmaze: "TVMaze", wikidata: "Wikidata", igdb: "IGDB", rawg: "RAWG", spotify: "Spotify", musicbrainz: "MusicBrainz", local: "Entreclase" }[source]);
const tasteYear = (taste: Taste) => taste.s && /^\d{4}$/.test(taste.s) ? Number(taste.s) : undefined;
const matchesTasteFilter = (taste: Taste, filter: TasteFilter) => {
  if (filter === "all") return true;
  if (filter === "cover") return !!taste.img;
  if (filter.startsWith("source:")) return taste.source === filter.slice(7);
  const year = tasteYear(taste);
  if (!year) return false;
  return filter === "recent" ? year >= new Date().getFullYear() - 5 : year < new Date().getFullYear() - 5;
};

export function QuickPicks({ profile, editable = false }: { profile: Profile; editable?: boolean }) {
  const { c, locale, repo, run, busy } = useCommunity();
  const answered = pickPairs.filter(pair => chosenIn(profile.picks, pair)).length;
  const choose = (pair: PickPair, option: PickOption) => {
    const current = chosenIn(profile.picks, pair);
    const rest = profile.picks.filter(slug => slug !== pair.a.slug && slug !== pair.b.slug);
    void run(async () => { await repo.saveProfile({ ...profileInput(profile), picks: current?.slug === option.slug ? rest : [...rest, option.slug] }); }, "");
  };
  if (!editable && !answered) return null;
  const pairs = editable ? pickPairs : pickPairs.filter(pair => chosenIn(profile.picks, pair));
  return <details className="u-card u-picks">
    <summary className="u-picks-summary">
      <div><p className="u-eyebrow">{c("quickPicks")}</p><h2 id="picks-title">{c("quickPicksTitle")}</h2><p className="u-muted">{answered}/{pickPairs.length} · {editable ? c("quickPicksBody") : c("quickPicksBodyOther")}</p></div>
      <span className="u-picks-summary-side">{editable && <span className="u-picks-score"><strong>{answered}</strong><small>/{pickPairs.length}</small></span>}<ChevronDown aria-hidden="true"/></span>
    </summary>
    <div className="u-picks-detail"><ul className="u-pick-grid">{pairs.map((pair, index) => {
      const current = chosenIn(profile.picks, pair);
      return <li className={`u-pick ${tone(index)}`} key={pair.id}>
        <p className="u-pick-title">{localePick(pair.title, locale)}</p>
        <div className="u-pick-options" role="group" aria-label={localePick(pair.title, locale)}>
          {[pair.a, pair.b].map(option => {
            const active = current?.slug === option.slug;
            const label = <><span aria-hidden="true">{option.emoji}</span>{localePick(option.label, locale)}</>;
            return editable
              ? <button type="button" key={option.slug} className={active ? "u-pick-option active" : "u-pick-option"} aria-pressed={active} disabled={busy} onClick={() => choose(pair, option)}>{label}</button>
              : <span key={option.slug} className={active ? "u-pick-option active" : "u-pick-option faded"}>{label}</span>;
          })}
        </div>
      </li>;
    })}</ul></div>
  </details>;
}

// What two people share, worked out from the profiles already loaded: no extra
// request, and it gives the first hello something to be about.
export function CommonGround({ other }: { other: Profile }) {
  const { c, locale, me } = useCommunity();
  const tastes = other.favorites.filter(taste => me.favorites.some(mine => sameTaste(mine, taste)));
  const picks = other.picks.filter(slug => me.picks.includes(slug));
  const shared = other.interests.filter(value => me.interests.includes(value));
  const sameCampus = other.campus === me.campus;
  const sameDegree = other.degree.toLocaleLowerCase() === me.degree.toLocaleLowerCase();
  const count = tastes.length + picks.length + shared.length + (sameCampus ? 1 : 0) + (sameDegree ? 1 : 0);
  if (!count) return <p className="u-muted u-small">{c("commonNone")}</p>;
  return <div className="u-common">
    <p className="u-common-count"><Sparkles aria-hidden="true"/>{count} {c(count === 1 ? "commonOne" : "commonMany")}</p>
    <div className="u-tags">
      {sameCampus && <span>{c("yourCampus")}</span>}
      {sameDegree && <span>{other.degree}</span>}
      {tastes.map(taste => <span key={`${taste.k}:${taste.id}`}>{taste.t}</span>)}
      {picks.map(slug => pickOptions[slug] && <span key={slug}>{localePick(pickOptions[slug].option.label, locale)}</span>)}
      {shared.map(value => <span key={value}>{value}</span>)}
    </div>
  </div>;
}

export function CommonBadge({ other }: { other: Profile }) {
  const { c, me } = useCommunity();
  const count = other.favorites.filter(taste => me.favorites.some(mine => sameTaste(mine, taste))).length
    + other.picks.filter(slug => me.picks.includes(slug)).length
    + other.interests.filter(value => me.interests.includes(value)).length;
  if (!count) return null;
  return <span className="u-common-badge"><Sparkles aria-hidden="true"/>{count} {c(count === 1 ? "commonOne" : "commonMany")}</span>;
}
