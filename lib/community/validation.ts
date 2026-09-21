import type { GroupInput, PlanInput, ProfileInput } from "./types";
import { campuses, interests, places, relationshipStatuses } from "./types";
import { validTastes } from "./tastes";
import { pickSlugs, pickPairs } from "./picks";
/* What a chat message may carry. GIFs count as images and keep their animation. */
const chatMedia: Record<string, { kind: "image" | "video"; ext: string; max: number }> = {
 "image/jpeg": { kind: "image", ext: "jpg", max: 8 }, "image/png": { kind: "image", ext: "png", max: 8 }, "image/webp": { kind: "image", ext: "webp", max: 8 },
 "image/gif": { kind: "image", ext: "gif", max: 12 }, "video/mp4": { kind: "video", ext: "mp4", max: 25 }, "video/webm": { kind: "video", ext: "webm", max: 25 },
};
export const chatMediaTypes = Object.keys(chatMedia).join(",");
export function validateChatMedia(file: File) { const rule = chatMedia[file.type]; if (!rule || !file.size || file.size > rule.max * 1048576) throw { code: "invalid_media" }; return rule; }
export function requireText(value: string, min: number, max: number) { if (typeof value !== "string" || value.trim().length < min || value.length > max) throw { code: "validation" }; }
export function validateProfile(input: ProfileInput) {
 requireText(input.name,2,60); requireText(input.degree,2,100); requireText(input.bio,0,400);
 if(!validTastes(input.favorites)) throw {code:"validation"};
 if(!Array.isArray(input.picks) || input.picks.length>pickPairs.length || input.picks.some(x=>!pickSlugs.includes(x)) || pickPairs.some(pair=>input.picks.includes(pair.a.slug)&&input.picks.includes(pair.b.slug)) || new Set(input.picks).size!==input.picks.length) throw {code:"validation"};
 if((!campuses.includes(input.campus as typeof campuses[number]) && input.campus!=="Valencia") || !Number.isInteger(input.year) || input.year<0 || input.year>6 || !Number.isInteger(input.color) || input.color<0 || input.color>5 || input.interests.length>5 || input.interests.some(x=>!interests.includes(x as typeof interests[number])) || !relationshipStatuses.includes(input.relationship_status)) throw {code:"validation"};
}
export function validatePlan(input: PlanInput) {
 requireText(input.title,3,100); requireText(input.description,0,1200); requireText(input.meeting_point,2,160);
 if(!places.includes(input.place as typeof places[number]) || !Number.isInteger(input.capacity) || input.capacity<2 || input.capacity>60 || !Number.isFinite(new Date(input.starts_at).getTime())) throw {code:"validation"};
 if(new Date(input.starts_at).getTime()<=Date.now()) throw {code:"past_date"};
}
export function validateGroup(input: GroupInput) { requireText(input.name,3,80); requireText(input.description,3,600); if(typeof input.is_private!=="boolean" || !["study","leisure","projects"].includes(input.category) || !campuses.includes(input.campus as typeof campuses[number])) throw {code:"validation"}; }
export async function validatePdf(file: File) { if(!file || !/\.pdf$/i.test(file.name) || (file.type && file.type!=="application/pdf") || file.size>10*1024*1024 || file.size<5 || await file.slice(0,5).text()!=="%PDF-") throw {code:"invalid_file"}; }
