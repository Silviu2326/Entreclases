import { validateLesson, validateFeedback } from "@/supabase/functions/_shared/learning";
import type { StudyActivity, StudyFeedback, StudyPreferences, StudySource } from "./learning";
async function invoke(body:Record<string, unknown>){
 const {getAuthClient}=await import("../../auth/client");
 const {data,error}=await getAuthClient().functions.invoke("study-session",{body});
 if(error){let message="No se pudo conectar con el tutor. Vuelve a intentarlo; tus avances siguen guardados.";
  const context=(error as {context?:Response}).context;
  if(context)try{message=(await context.json()).error??message;}catch{/* never expose raw provider errors */}
  throw new Error(message);
 }return data;
}
export async function prepareLearning(input:{language:"es"|"va";preferences:StudyPreferences;sources:StudySource[];subject:string;topic:string;review:string[]}){
 const data=await invoke({action:"prepare",...input});return validateLesson(data,input.sources);
}
export async function evaluateLearning(input:{language:"es"|"va";preferences:StudyPreferences;sources:StudySource[];activity:StudyActivity;answer:string}):Promise<StudyFeedback>{return validateFeedback(await invoke({action:"evaluate",...input}));}
