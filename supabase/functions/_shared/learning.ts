// Shared, dependency-free contract: the browser and Edge Function validate the same lesson.
export type StudyMode = "mixed" | "spot-error" | "teach" | "case" | "connect" | "sprint";
export type ActivityKind = "choice" | "spot-error" | "teach" | "case" | "connect";
export type StudyPreferences = { goal: string; minutes: 5 | 10 | 20; interests: string[]; tone: "peer" | "teacher" | "simple"; experience: string; mode: StudyMode };
export type StudySource = { id: string; name: string; text: string };
export type StudyActivity = { kind: ActivityKind; topic: string; prompt: string; options: string[]; answer: number; correctOrder: number[]; modelAnswer: string; explanation: string; hint: string; sourceId: string; quote: string };
export type StudyLesson = { title: string; objective: string; introduction: string; activities: StudyActivity[] };
export type StudyFeedback = { verdict: "correct" | "partial" | "revisit" | "insufficient"; feedback: string; nextQuestion: string };
const str = { type: "string" };
const object = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
export const lessonSchema = object({title:str, objective:str, introduction:str, activities:{type:"array", minItems:3, maxItems:6, items:object({kind:{type:"string",enum:["choice","spot-error","teach","case","connect"]},topic:str,prompt:str,options:{type:"array",items:str},answer:{type:"integer"},correctOrder:{type:"array",items:{type:"integer"}},modelAnswer:str,explanation:str,hint:str,sourceId:str,quote:str})}});
export const feedbackSchema = object({verdict:{type:"string",enum:["correct","partial","revisit","insufficient"]},feedback:str,nextQuestion:str});
export const normalizeQuote = (s: string) => s.replace(/\s+/g," ").trim();
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 6000): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
export function validateLesson(value: unknown, sources: StudySource[]): StudyLesson {
  if (!record(value) || !text(value.title,200) || !text(value.objective,1000) || !text(value.introduction) || !Array.isArray(value.activities) || value.activities.length < 3 || value.activities.length > 6) throw new Error("LESSON_INVALID");
  for (const a of value.activities) {
    if (!record(a) || !["choice","spot-error","teach","case","connect"].includes(String(a.kind)) || !["topic","prompt","modelAnswer","explanation","hint","sourceId","quote"].every(k=>text(a[k]))) throw new Error("LESSON_INVALID");
    const source = sources.find(s=>s.id === a.sourceId);
    if (!source || String(a.quote).trim().length < 20 || !normalizeQuote(source.text).includes(normalizeQuote(String(a.quote)))) throw new Error("LESSON_SOURCE_INVALID");
    if (!Array.isArray(a.options) || !a.options.every(o=>text(o,800)) || !Array.isArray(a.correctOrder) || !Number.isInteger(a.answer)) throw new Error("LESSON_INVALID");
    if (a.kind === "connect") {
      const n=a.options.length;
      if(n<3 || n>6 || a.correctOrder.length!==n || new Set(a.correctOrder).size!==n || !a.correctOrder.every(i=>Number.isInteger(i)&&i>=0&&i<n)) throw new Error("LESSON_INVALID");
    } else if(a.kind !== "teach" && (a.options.length<2 || a.options.length>4 || Number(a.answer)<0 || Number(a.answer)>=a.options.length)) throw new Error("LESSON_INVALID");
  }
  return value as unknown as StudyLesson;
}
export function validateSessionLesson(value:unknown,sources:StudySource[],preferences:StudyPreferences):StudyLesson {
 const lesson=validateLesson(value,sources);
 const count=preferences.minutes===5?3:preferences.minutes===10?4:6;
 if(lesson.activities.length!==count||lesson.activities[0].kind!=="choice")throw new Error("LESSON_FORMAT_INVALID");
 if(!["mixed","sprint"].includes(preferences.mode)&&!lesson.activities.some(a=>a.kind===preferences.mode))throw new Error("LESSON_MODE_INVALID");
 return lesson;
}
export function validateFeedback(value: unknown): StudyFeedback {
  if(!record(value) || !["correct","partial","revisit","insufficient"].includes(String(value.verdict)) || !text(value.feedback) || typeof value.nextQuestion!=="string") throw new Error("FEEDBACK_INVALID");
  return value as unknown as StudyFeedback;
}
export function validPreferences(v: unknown): v is StudyPreferences {
  return record(v) && text(v.goal,160) && typeof v.minutes==="number" && [5,10,20].includes(v.minutes) && ["peer","teacher","simple"].includes(String(v.tone)) && typeof v.experience === "string" && v.experience.length<=500 && Array.isArray(v.interests) && v.interests.length<=8 && v.interests.every(i=>text(i,80)) && ["mixed","spot-error","teach","case","connect","sprint"].includes(String(v.mode));
}
