import type { GroupInput, PlanInput, ProfileInput } from "./types";
import { campuses, interests, places, relationshipStatuses } from "./types";
export function requireText(value: string, min: number, max: number) { if (typeof value !== "string" || value.trim().length < min || value.length > max) throw { code: "validation" }; }
export function validateProfile(input: ProfileInput) {
 requireText(input.name,2,60); requireText(input.degree,2,100); requireText(input.bio,0,400);
 if(!campuses.includes(input.campus as typeof campuses[number]) || !Number.isInteger(input.year) || input.year<1 || input.year>6 || !Number.isInteger(input.color) || input.color<0 || input.color>5 || input.interests.length>5 || input.interests.some(x=>!interests.includes(x as typeof interests[number])) || !relationshipStatuses.includes(input.relationship_status)) throw {code:"validation"};
}
export function validatePlan(input: PlanInput) {
 requireText(input.title,3,100); requireText(input.description,0,1200); requireText(input.meeting_point,2,160);
 if(!places.includes(input.place as typeof places[number]) || !Number.isInteger(input.capacity) || input.capacity<2 || input.capacity>60 || !Number.isFinite(new Date(input.starts_at).getTime())) throw {code:"validation"};
 if(new Date(input.starts_at).getTime()<=Date.now()) throw {code:"past_date"};
}
export function validateGroup(input: GroupInput) { requireText(input.name,3,80); requireText(input.description,3,600); if(!["study","leisure","projects"].includes(input.category) || !campuses.includes(input.campus as typeof campuses[number])) throw {code:"validation"}; }
export async function validatePdf(file: File) { if(!file || !/\.pdf$/i.test(file.name) || (file.type && file.type!=="application/pdf") || file.size>10*1024*1024 || file.size<5 || await file.slice(0,5).text()!=="%PDF-") throw {code:"invalid_file"}; }
