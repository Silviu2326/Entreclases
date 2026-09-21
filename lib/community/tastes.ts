// Tastes are searched in public catalogues but stored already resolved: title,
// subtitle and the cover path. Looking at a profile never calls an API, so the
// shelf works offline and survives any catalogue going away.
// Only the path and an allow-listed source are stored; the host comes from the
// fixed bases below, so a saved profile can never point the browser at an
// arbitrary third-party image.
export const tasteKinds = ["tv", "film", "game", "music"] as const;
export type TasteKind = (typeof tasteKinds)[number];
export type TasteSource = "local" | "tmdb" | "omdb" | "tvmaze" | "wikidata" | "igdb" | "spotify" | "musicbrainz" | "rawg";
export type Taste = { k: TasteKind; id: string; t: string; s?: string; img?: string; source?: TasteSource; now?: boolean };

export const tastesPerKind = 5;
export const tasteIdPattern = /^[A-Za-z0-9:._-]{1,40}$/;
export const tasteImagePattern = /^[A-Za-z0-9%/_.!~*'()?\-]{1,220}$/;

const tmdbKey = process.env.NEXT_PUBLIC_TMDB_KEY?.trim() ?? "";
const omdbKey = process.env.NEXT_PUBLIC_OMDB_KEY?.trim() ?? "";
const tvmazeKey = process.env.NEXT_PUBLIC_TVMAZE_KEY?.trim() ?? "";
const rawgKey = process.env.NEXT_PUBLIC_RAWG_KEY?.trim() ?? "";
const igdbClientId = process.env.NEXT_PUBLIC_IGDB_CLIENT_ID?.trim() ?? "";
const igdbAccessToken = process.env.NEXT_PUBLIC_IGDB_ACCESS_TOKEN?.trim() ?? "";
const spotifyAccessToken = process.env.NEXT_PUBLIC_SPOTIFY_ACCESS_TOKEN?.trim() ?? "";

const bases: Record<TasteKind, string> = {
  tv: "https://image.tmdb.org/t/p/w185/",
  film: "https://image.tmdb.org/t/p/w185/",
  game: "https://images.igdb.com/igdb/image/upload/t_cover_big/",
  music: "https://coverartarchive.org/",
};

export function coverUrl(taste: Taste) {
  if (!taste.img) return undefined;
  if (taste.source === "tvmaze") return taste.img;
  if (taste.source === "wikidata") return `https://commons.wikimedia.org/wiki/Special:FilePath/${taste.img}?width=300`;
  if (taste.source === "omdb") return `https://m.media-amazon.com/${taste.img}`;
  if (taste.source === "spotify") return `https://i.scdn.co/${taste.img}`;
  if (taste.source === "rawg") return `https://media.rawg.io/${taste.img}`;
  return bases[taste.k] + taste.img;
}

const trim = (value: string, max: number) => value.trim().slice(0, max);
const strip = (url: string, host: string) => { const at = url.indexOf(host); return at < 0 ? undefined : url.slice(at + host.length); };

type TmdbRow = { id?: number; name?: string; title?: string; poster_path?: string | null; first_air_date?: string; release_date?: string };
type OmdbRow = { Title?: string; Year?: string; imdbID?: string; Type?: string; Poster?: string };
type TvmazeRow = { show?: { id?: number; name?: string; premiered?: string | null; image?: { medium?: string | null; original?: string | null }; network?: { name?: string } | null; webChannel?: { name?: string } | null } };
type RawgRow = { id?: number; name?: string; released?: string; background_image?: string | null };
type IgdbRow = { id?: number; name?: string; first_release_date?: number; cover?: { image_id?: string } };
type SpotifyRow = { id?: string; name?: string; artists?: Array<{ name?: string }>; images?: Array<{ url?: string }> };
type MusicBrainzRow = { id?: string; title?: string; "first-release-date"?: string; "cover-art-archive"?: { front?: boolean } };
type WikidataClaim = { mainsnak?: { datavalue?: { value?: unknown } } };

function endpoint(kind: TasteKind, query: string) {
  const q = encodeURIComponent(query);
  if (kind === "tv") return tmdbKey
    ? `https://api.themoviedb.org/3/search/tv?api_key=${tmdbKey}&language=es-ES&include_adult=false&page=1&query=${q}`
    : `https://api.tvmaze.com/search/shows?q=${q}${tvmazeKey ? `&api_key=${encodeURIComponent(tvmazeKey)}` : ""}`;
  if (kind === "film") return omdbKey
    ? `https://www.omdbapi.com/?apikey=${encodeURIComponent(omdbKey)}&s=${q}&type=movie&page=1`
    : tmdbKey ? `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&language=es-ES&include_adult=false&page=1&query=${q}` : null;
  if (kind === "game" && igdbClientId && igdbAccessToken) return "https://api.igdb.com/v4/games";
  if (kind === "game" && rawgKey) return `https://api.rawg.io/api/games?key=${rawgKey}&page_size=20&search=${q}`;
  return null;
}

const keep = (items: (Taste | null)[]): Taste[] => items.filter((item): item is Taste => item !== null);

// iTunes answers by term match, which buries the obvious album under remixes and
// singles of the same name. A stable nudge puts the closest title first.
function rank(items: Taste[], query: string): Taste[] {
  const needle = fold(query.trim());
  if (!needle) return items;
  const score = (taste: Taste) => (fold(taste.t) === needle ? 4 : fold(taste.t).startsWith(needle) ? 2 : 0) + (fold(taste.s ?? "").includes(needle) ? 1 : 0);
  return items.map((item, index) => ({ item, index, score: score(item) })).sort((a, b) => b.score - a.score || a.index - b.index).map(entry => entry.item);
}

function parse(kind: TasteKind, payload: unknown): Taste[] {
  const body = (payload ?? {}) as { results?: unknown[]; albums?: { items?: unknown[] }; "release-groups"?: unknown[] };
  const rows = Array.isArray(payload) ? payload : kind === "music" && Array.isArray(body["release-groups"])
    ? body["release-groups"]
    : kind === "music" && Array.isArray(body.albums?.items)
      ? body.albums.items
      : Array.isArray(body.results) ? body.results : [];
  if (kind === "game") return keep(rows.map((row): Taste | null => {
    if (igdbClientId && igdbAccessToken && "cover" in (row as object)) {
      const game = row as IgdbRow;
      const title = trim(game.name ?? "", 60);
      if (!game.id || !title) return null;
      const year = game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : undefined;
      return { k: kind, id: `igdb:${game.id}`, t: title, s: year ? String(year) : undefined, img: game.cover?.image_id ? `${game.cover.image_id}.jpg` : undefined, source: "igdb" } satisfies Taste;
    }
    const game = row as RawgRow;
    const title = trim(game.name ?? "", 60);
    if (!game.id || !title) return null;
    return { k: kind, id: `rawg:${game.id}`, t: title, s: game.released?.slice(0, 4), img: game.background_image ? strip(game.background_image, "media.rawg.io/") : undefined, source: "rawg" } satisfies Taste;
  }));
  if (kind === "tv" && !tmdbKey) return keep(rows.map((row): Taste | null => {
    const show = (row as TvmazeRow).show;
    const title = trim(show?.name ?? "", 60);
    if (!show?.id || !title) return null;
    return { k: kind, id: `tvmaze:${show.id}`, t: title, s: show.premiered?.slice(0, 4), img: show.image?.medium ?? show.image?.original ?? undefined, source: "tvmaze" } satisfies Taste;
  }));
  if (kind === "film" && omdbKey) return keep(rows.map((row): Taste | null => {
    const movie = row as OmdbRow;
    const title = trim(movie.Title ?? "", 60);
    if (!movie.imdbID || !title || movie.Type !== "movie") return null;
    return { k: kind, id: `omdb:${movie.imdbID}`, t: title, s: movie.Year?.slice(0, 4), img: movie.Poster && movie.Poster !== "N/A" ? strip(movie.Poster, "m.media-amazon.com/") : undefined, source: "omdb" } satisfies Taste;
  }));
  if (kind === "music") return keep(rows.map((row): Taste | null => {
    if ("artists" in (row as object)) {
      const album = row as SpotifyRow;
      const title = trim(album.name ?? "", 60);
      if (!album.id || !title) return null;
      return { k: kind, id: `spotify:${album.id}`, t: title, s: album.artists?.[0]?.name ? trim(album.artists[0].name, 60) : undefined, img: album.images?.[0]?.url ? strip(album.images[0].url, "i.scdn.co/") : undefined, source: "spotify" } satisfies Taste;
    }
    const album = row as MusicBrainzRow;
    const title = trim(album.title ?? "", 60);
    if (!album.id || !title) return null;
    return { k: kind, id: `mb:${album.id}`, t: title, s: album["first-release-date"]?.slice(0, 4), img: album["cover-art-archive"]?.front ? `release-group/${album.id}/front-250` : undefined, source: "musicbrainz" } satisfies Taste;
  }));
  return keep(rows.map((row): Taste | null => {
    const entry = row as TmdbRow;
    const title = trim(entry.name ?? entry.title ?? "", 60);
    if (!entry.id || !title) return null;
    return { k: kind, id: `tmdb:${entry.id}`, t: title, s: (entry.first_air_date ?? entry.release_date ?? "").slice(0, 4) || undefined, img: entry.poster_path ? entry.poster_path.replace(/^\//, "") : undefined, source: "tmdb" } satisfies Taste;
  }));
}

// Shown before anyone types, and whenever a key is missing or the network fails,
// so the picker is never an empty box.
const suggestions: Record<TasteKind, string[]> = {
  tv: ["La que se avecina", "The Office", "Merlí", "Arcane", "Euphoria", "Rick y Morty", "Dark", "Friends", "Élite", "Bluey", "Sucesión", "The Last of Us", "Paquita Salas", "Las de la última fila", "Breaking Bad", "One Piece"],
  film: ["El padrino", "Parásitos", "Interstellar", "Coco", "Spider-Man: Un nuevo universo", "Whiplash", "La La Land", "El viaje de Chihiro", "Torrente", "Barbie", "Oppenheimer", "Tenéis que venir a verla", "As bestas", "Cadena perpetua", "Todo a la vez en todas partes", "Campeones"],
  game: ["Minecraft", "Valorant", "League of Legends", "FIFA", "Fortnite", "The Legend of Zelda", "Stardew Valley", "Elden Ring", "Animal Crossing", "GTA V", "Hollow Knight", "Mario Kart", "Among Us", "Clash Royale", "It Takes Two", "Red Dead Redemption 2"],
  music: ["Rosalía", "Bad Bunny", "Aitana", "C. Tangana", "Arctic Monkeys", "Rigoberta Bandini", "Zahara", "Quevedo", "Taylor Swift", "La Oreja de Van Gogh", "Estopa", "Karol G", "Vetusta Morla", "Natos y Waor", "Amaral", "Dua Lipa"],
};

const slug = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 34);
const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function localMatches(kind: TasteKind, query: string): Taste[] {
  const needle = fold(query.trim());
  return suggestions[kind]
    .filter(title => !needle || fold(title).includes(needle))
    .map(title => ({ k: kind, id: `own:${slug(title)}`, t: title }));
}

// Builds an entry from the built-in list: same shape the picker produces when
// no API key is configured. Used by the demo and preview fixtures.
export const localTaste = (k: TasteKind, t: string, now = false): Taste => now ? { k, id: `own:${slug(t)}`, t, now } : { k, id: `own:${slug(t)}`, t };

async function searchMusic(query: string, signal?: AbortSignal): Promise<Taste[]> {
  const encoded = encodeURIComponent(query);
  const requests: Promise<Taste[]>[] = [];
  if (spotifyAccessToken) {
    requests.push(fetch(`https://api.spotify.com/v1/search?type=album&limit=20&q=${encoded}`, { signal, headers: { Authorization: `Bearer ${spotifyAccessToken}` } }).then(async response => response.ok ? parse("music", await response.json()) : []));
  }
  requests.push(fetch(`https://musicbrainz.org/ws/2/release-group/?query=${encoded}&fmt=json&limit=20`, { signal, headers: { Accept: "application/json" } }).then(async response => response.ok ? parse("music", await response.json()) : []));
  const responses = await Promise.allSettled(requests);
  const unique = new Map<string, Taste>();
  for (const response of responses) if (response.status === "fulfilled") for (const item of response.value) unique.set(`${item.k}:${item.t.toLocaleLowerCase()}`, item);
  return [...unique.values()];
}

async function searchWikidataFilms(query: string, signal?: AbortSignal): Promise<Taste[]> {
  const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=es&uselang=es&type=item&limit=20&format=json&origin=*`;
  const searchResponse = await fetch(searchUrl, { signal, headers: { Accept: "application/json" } });
  if (!searchResponse.ok) return [];
  const search = await searchResponse.json() as { search?: Array<{ id?: string; label?: string; description?: string }> };
  const ids = (search.search ?? []).map(item => item.id).filter((id): id is string => !!id && /^Q\d+$/.test(id));
  if (!ids.length) return [];
  const entityResponse = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join("|")}&props=claims|labels|descriptions&languages=es|en&format=json&origin=*`, { signal, headers: { Accept: "application/json" } });
  if (!entityResponse.ok) return [];
  const body = await entityResponse.json() as { entities?: Record<string, { labels?: Record<string, { value?: string }>; descriptions?: Record<string, { value?: string }>; claims?: Record<string, WikidataClaim[]> }> };
  const value = (claims: Record<string, WikidataClaim[]> | undefined, property: string) => claims?.[property]?.[0]?.mainsnak?.datavalue?.value as { id?: string; time?: string } | string | undefined;
  return keep(ids.map(id => {
    const entity = body.entities?.[id];
    if (!entity) return null;
    const title = trim(entity.labels?.es?.value ?? entity.labels?.en?.value ?? "", 60);
    const description = entity.descriptions?.es?.value ?? entity.descriptions?.en?.value ?? "";
    const instances = entity.claims?.P31?.map(item => (item.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id).filter(Boolean) ?? [];
    const looksLikeFilm = instances.includes("Q11424") || /pel[ií]cula|largometraje|film|movie/i.test(description);
    if (!title || !looksLikeFilm) return null;
    const released = value(entity.claims, "P577");
    const poster = value(entity.claims, "P18");
    const filename = typeof poster === "string" ? poster : undefined;
    const encodedFilename = filename ? encodeURIComponent(filename).replace(/'/g, "%27") : undefined;
    return { k: "film", id: `wd:${id}`, t: title, s: typeof released === "object" ? released.time?.slice(1, 5) : undefined, img: encodedFilename, source: "wikidata" } satisfies Taste;
  }));
}

export async function searchTastes(kind: TasteKind, query: string, signal?: AbortSignal): Promise<{ items: Taste[]; local: boolean }> {
  const text = query.trim();
  if (kind === "music" && text) {
    try {
      const found = await searchMusic(text, signal);
      if (found.length) return { items: rank(found, text).slice(0, 24), local: false };
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") throw error;
    }
  }
  if (kind === "film" && text && !tmdbKey) {
    try {
      const found = await searchWikidataFilms(text, signal);
      if (found.length) return { items: rank(found, text).slice(0, 24), local: false };
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") throw error;
    }
  }
  const url = text ? endpoint(kind, text) : null;
  if (url) {
    try {
      const isIgdb = kind === "game" && igdbClientId && igdbAccessToken;
      const response = await fetch(url, isIgdb
        ? { method: "POST", signal, headers: { "Client-ID": igdbClientId, Authorization: `Bearer ${igdbAccessToken}`, "Content-Type": "text/plain" }, body: `search \"${text.replace(/[\";]/g, "") }\"; fields name,first_release_date,cover.image_id; limit 20;` }
        : { signal });
      if (response.ok) {
        const payload = await response.json();
        const found = parse(kind, isIgdb ? payload : payload);
        const items = kind === "music" ? rank(found, text) : found;
        if (items.length) return { items: items.slice(0, 24), local: false };
      }
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") throw error;
    }
  }
  return { items: localMatches(kind, text).slice(0, 24), local: true };
}

export const sameTaste = (a: Taste, b: Taste) => a.k === b.k && a.id === b.id;

export function validTastes(list: unknown): list is Taste[] {
  if (!Array.isArray(list) || list.length > tasteKinds.length * tastesPerKind) return false;
  const seen = new Set<string>(), current = new Set<TasteKind>();
  for (const entry of list) {
    const taste = entry as Taste;
    if (!taste || typeof taste !== "object") return false;
    if (!tasteKinds.includes(taste.k) || typeof taste.id !== "string" || !tasteIdPattern.test(taste.id)) return false;
    if (typeof taste.t !== "string" || !taste.t.trim() || taste.t.length > 60) return false;
    if (taste.s !== undefined && (typeof taste.s !== "string" || taste.s.length > 60)) return false;
    if (taste.img !== undefined && (typeof taste.img !== "string" || !tasteImagePattern.test(taste.img))) return false;
    if (taste.source !== undefined && !["local", "tmdb", "omdb", "tvmaze", "wikidata", "igdb", "spotify", "musicbrainz", "rawg"].includes(taste.source)) return false;
    if (taste.now !== undefined && typeof taste.now !== "boolean") return false;
    if (taste.now) { if (current.has(taste.k)) return false; current.add(taste.k); }
    const key = `${taste.k}:${taste.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (list.filter(other => (other as Taste).k === taste.k).length > tastesPerKind) return false;
  }
  return true;
}

export const byKind = (list: Taste[], kind: TasteKind) => list.filter(taste => taste.k === kind);
