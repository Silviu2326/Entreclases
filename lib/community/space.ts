// The personal space of a profile: which blocks show and in what order, one of
// a fixed set of backgrounds, and stickers pinned on the cover. The blocks and
// the background travel as one JSON on the profile; stickers have their own
// table because each one is moved on its own.
export const profileBlocks = ["showcase", "network", "shelf", "picks", "games", "achievements", "credits", "plusone"] as const;
export type ProfileBlock = typeof profileBlocks[number];
// What a visitor can be shown of somebody else. The rest only exists for its owner.
export const visitorBlocks: readonly ProfileBlock[] = ["showcase", "shelf", "picks", "games"];
export const spaceBackgrounds = ["papel", "cuaderno", "corcho", "cielo", "turia", "malvarrosa", "noche", "pizarra", "lima", "terrazo"] as const;
export type SpaceBackground = typeof spaceBackgrounds[number];
export type ProfileSpace = { background: SpaceBackground; hidden: ProfileBlock[]; order: ProfileBlock[] };
export const defaultSpace = (): ProfileSpace => ({ background: "papel", hidden: [], order: [...profileBlocks] });
const isBlock = (value: unknown): value is ProfileBlock => typeof value === "string" && (profileBlocks as readonly string[]).includes(value);

// Whatever the column holds becomes a complete, valid space: unknown blocks
// are dropped, missing ones go to the end, an odd background falls back.
export function readSpace(value: unknown): ProfileSpace {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const background = (spaceBackgrounds as readonly string[]).includes(raw.background as string) ? raw.background as SpaceBackground : "papel";
  const hidden = Array.isArray(raw.hidden) ? [...new Set(raw.hidden.filter(isBlock))] : [];
  const listed = Array.isArray(raw.order) ? [...new Set(raw.order.filter(isBlock))] : [];
  return { background, hidden, order: [...listed, ...profileBlocks.filter(block => !listed.includes(block))] };
}
export function validateSpace(space: ProfileSpace) {
  if (!spaceBackgrounds.includes(space.background)) throw { code: "validation" };
  for (const list of [space.hidden, space.order]) if (!Array.isArray(list) || list.some(block => !isBlock(block)) || new Set(list).size !== list.length) throw { code: "validation" };
  if (space.order.length !== profileBlocks.length) throw { code: "validation" };
}
export function orderedBlocks(space: ProfileSpace, subset: readonly ProfileBlock[] = profileBlocks) {
  return space.order.filter(block => subset.includes(block) && !space.hidden.includes(block));
}

// Stickers. A few come with the app; the rest are pictures the owner uploads,
// cut out in the browser and stored as a small webp with transparency.
export const builtinStickers = ["hola", "cafe", "planta", "corazon", "estrella", "chincheta", "boli", "sol"] as const;
export type BuiltinSticker = typeof builtinStickers[number];
export const stickerLimits = { count: 12, output: 512 * 1024, size: 512 } as const;
export const stickerPathPattern = /^[a-f0-9-]{36}\/sticker-[a-f0-9-]{36}\.webp$/;
export const isBuiltinSticker = (path: string): path is `builtin:${BuiltinSticker}` => path.startsWith("builtin:") && (builtinStickers as readonly string[]).includes(path.slice(8));
export const builtinStickerUrl = (name: BuiltinSticker) => `/stickers/${name}.svg`;
export const isStoredSticker = (path?: string | null) => !!path && !path.startsWith("builtin:") && !path.startsWith("/") && !path.startsWith("blob:") && !path.startsWith("data:");
export type StickerPlacement = { x: number; y: number; scale: number; rotation: number; z: number };
export const defaultPlacement = (): StickerPlacement => ({ x: 50, y: 50, scale: 1, rotation: 0, z: 0 });
export function validatePlacement(p: StickerPlacement) {
  const finite = [p.x, p.y, p.scale, p.rotation, p.z].every(Number.isFinite);
  if (!finite || p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100 || p.scale < 0.25 || p.scale > 3 || !Number.isInteger(p.rotation) || p.rotation < -180 || p.rotation > 180 || !Number.isInteger(p.z) || p.z < 0 || p.z > 99) throw { code: "validation" };
}
export const clampPlacement = (p: StickerPlacement): StickerPlacement => ({
  x: Math.min(100, Math.max(0, Math.round(p.x * 100) / 100)), y: Math.min(100, Math.max(0, Math.round(p.y * 100) / 100)),
  scale: Math.min(3, Math.max(0.25, Math.round(p.scale * 100) / 100)), rotation: ((Math.round(p.rotation) + 540) % 360) - 180, z: Math.min(99, Math.max(0, Math.round(p.z))),
});
