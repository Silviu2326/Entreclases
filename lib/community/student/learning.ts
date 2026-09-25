import type { StudyActivity, StudyFeedback, StudyLesson, StudyPreferences, StudySource } from "@/supabase/functions/_shared/learning";
export type { StudyActivity, StudyFeedback, StudyLesson, StudyPreferences, StudySource, StudyMode } from "@/supabase/functions/_shared/learning";
export type Subject = { id:string; name:string; examDate:string; noteIds:string[]; createdAt:string; topic?:string; goal?:string; course?:string; archived?:boolean };
export type SubjectState = { subjects:Subject[] };
export const emptySubjects: SubjectState = {subjects:[]};
export type AnswerRecord = { answer:string; correct:boolean; hinted:boolean; feedback:StudyFeedback; at:string };
export type StudySession = { id:string; subjectId:string; subjectName:string; createdAt:string; minutes:number; lesson:StudyLesson; sources:StudySource[]; answers:Record<string,AnswerRecord>; current:number; completedAt?:string; interestContext:string[]; drafts?:Record<string,{answer:string;hinted:boolean;revealed?:boolean}> };
export type SessionSummary = { id:string; subjectId:string; subjectName:string; title:string; objective:string; completedAt:string; minutes:number; activities:number; independent:number; topics:string[] };
export type ConceptMemory = { id:string; subjectId:string; topic:string; attempts:number; correct:number; independentDays:string[]; lastStudied:string; reviewAt:string; lastOutcome:string };
export type LearningState = { version:1; archive?:SessionSummary[]; preferences:StudyPreferences; sessions:StudySession[]; concepts:ConceptMemory[]; activeId:string|null };
export const emptyLearning: LearningState = {version:1,preferences:{goal:"Seguir las clases",minutes:10,interests:[],tone:"peer",experience:"",mode:"mixed"},sessions:[],concepts:[],activeId:null};
export function choiceCorrect(activity:StudyActivity, answer:string):boolean {
  if(activity.kind === "teach") return false;
  if(activity.kind === "connect") return answer === activity.correctOrder.join(",");
  return answer!=="" && Number(answer) === activity.answer;
}
export function recordAnswer(state:LearningState, sessionId:string, index:number, answer:AnswerRecord):LearningState {
  return {...state,sessions:state.sessions.map(s=>s.id===sessionId&&!s.completedAt&&!s.answers[index]?{...s,answers:{...s.answers,[index]:answer}}:s)};
}
export function finishSession(state:LearningState, sessionId:string, now=new Date()):LearningState {
  const session=state.sessions.find(s=>s.id===sessionId);
  if(!session || session.completedAt || session.lesson.activities.some((_,i)=>!session.answers[i])) return state;
  const memories=new Map(state.concepts.map(c=>[c.id,c]));
  const grouped=new Map<string,AnswerRecord[]>();
  session.lesson.activities.forEach((a,i)=>{const key=a.topic.trim().toLocaleLowerCase();grouped.set(key,[...(grouped.get(key)??[]),session.answers[i]]);});
  for(const [topic,answers] of grouped){
    const id=session.subjectId+":"+topic, old=memories.get(id);
    const independent=answers.every(a=>a.correct&&!a.hinted);
    const days=independent?[...new Set([...(old?.independentDays??[]),now.toISOString().slice(0,10)])]:(old?.independentDays??[]);
    const interval=independent?[1,3,7,14][Math.min(days.length-1,3)]:1;
    const due=new Date(now);due.setDate(due.getDate()+interval);
    memories.set(id,{id,subjectId:session.subjectId,topic,attempts:(old?.attempts??0)+answers.length,correct:(old?.correct??0)+answers.filter(a=>a.correct).length,independentDays:days,lastStudied:now.toISOString(),reviewAt:due.toISOString(),lastOutcome:independent?"independent":"review"});
  }
  return compactHistory({...state,activeId:state.activeId===sessionId?null:state.activeId,concepts:[...memories.values()],sessions:state.sessions.map(s=>s.id===sessionId?{...s,completedAt:now.toISOString()}:s)});
}
/** Keep recent sessions in full; retain summaries and concept progress for the whole course. */
export function summarizeSession(s:StudySession):SessionSummary {
  return {id:s.id,subjectId:s.subjectId,subjectName:s.subjectName,title:s.lesson.title,objective:s.lesson.objective,completedAt:s.completedAt!,minutes:s.minutes,activities:s.lesson.activities.length,independent:Object.values(s.answers).filter(a=>a.correct&&!a.hinted).length,topics:[...new Set(s.lesson.activities.map(a=>a.topic))]};
}
export function compactHistory(state:LearningState):LearningState {
  const older=state.sessions.filter(s=>s.completedAt).sort((a,b)=>b.completedAt!.localeCompare(a.completedAt!)).slice(20);
  if(!older.length)return state;
  const ids=new Set(older.map(s=>s.id));
  const archive=new Map((state.archive??[]).map(s=>[s.id,s]));
  older.forEach(s=>archive.set(s.id,summarizeSession(s)));
  return {...state,sessions:state.sessions.filter(s=>!ids.has(s.id)),archive:[...archive.values()].sort((a,b)=>b.completedAt.localeCompare(a.completedAt))};
}
export function dueConcepts(state:LearningState, now=new Date()){return state.concepts.filter(c=>new Date(c.reviewAt)<=now).sort((a,b)=>a.reviewAt.localeCompare(b.reviewAt));}
export function nextSubject(subjects:Subject[], state:LearningState, now=new Date()){
  const active=subjects.filter(s=>!s.archived);
  const due=dueConcepts(state,now).find(c=>active.some(s=>s.id===c.subjectId));
  if(due) return active.find(s=>s.id===due.subjectId);
  return [...active].sort((a,b)=>{
    const last=(id:string)=>[...state.sessions.filter(s=>s.subjectId===id&&s.completedAt).map(s=>s.completedAt!),...(state.archive??[]).filter(s=>s.subjectId===id).map(s=>s.completedAt)].sort().at(-1)??"";
    return last(a.id).localeCompare(last(b.id));
  })[0];
}
