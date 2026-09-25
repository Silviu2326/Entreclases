// OpenAI Responses transport, shared by the existing tutor and guided sessions.
const env=(key:string)=>Deno.env.get(key)??"";
export const studyModel=()=>env("STUDY_MODEL")||"gpt-6-luna";
export function studyConfigured(){return !!env("OPENAI_API_KEY");}
export class StudyAIError extends Error { constructor(public status:number,message:string){super(message);} }
export async function requestAI(body:Record<string,unknown>,signal?:AbortSignal){
 const response=await fetch(`${(env("OPENAI_BASE_URL")||"https://api.openai.com/v1").replace(/\/$/,"")}/responses`,{method:"POST",headers:{authorization:`Bearer ${env("OPENAI_API_KEY")}`,"content-type":"application/json"},body:JSON.stringify({model:studyModel(),store:false,reasoning:{effort:"low"},max_output_tokens:8000,...body}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000)});
 if(!response.ok){await response.body?.cancel();throw new StudyAIError(response.status,"STUDY_AI_UNAVAILABLE");}return response;
}
export function outputText(body:unknown){
 const data=body as {status?:string;output?:{type:string;content?:{type:string;text?:string}[]}[]};
 if(data.status!=="completed")throw new StudyAIError(502,"STUDY_AI_INCOMPLETE");
 const parts=(data.output??[]).filter(o=>o.type==="message").flatMap(o=>o.content??[]);
 if(parts.some(p=>p.type==="refusal"))throw new StudyAIError(422,"STUDY_AI_REFUSAL");
 const text=parts.filter(p=>p.type==="output_text").map(p=>p.text??"").join("");if(!text.trim())throw new StudyAIError(502,"STUDY_AI_EMPTY");return text;
}
export async function structuredAI(instructions:string,input:unknown[],name:string,schema:unknown,signal?:AbortSignal){
 const response=await requestAI({instructions,input,text:{format:{type:"json_schema",name,schema,strict:true}}},signal);
 return JSON.parse(outputText(await response.json()));
}
export async function* responseEvents(response:Response){
 if(!response.body)throw new StudyAIError(502,"STUDY_AI_EMPTY");
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="";
 try{for(;;){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done}).replace(/\r/g,"");let end:number;
  while((end=buffer.indexOf("\n\n"))>=0){const block=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=block.split("\n").filter(l=>l.startsWith("data:")).map(l=>l.slice(5).trimStart()).join("\n");if(data&&data!=="[DONE]")yield JSON.parse(data);}
  if(done)break;
 }}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function aiErrorMessage(error:unknown,va=false){
 if(error instanceof StudyAIError && error.status===429)return va?"El tutor està ocupat. Torna-ho a provar en un moment.":"El tutor está ocupado. Inténtalo de nuevo en un momento.";
 if(error instanceof StudyAIError && error.status===422)return va?"No s’ha pogut preparar aquesta activitat. Prova amb un altre fragment.":"No se ha podido preparar esta actividad. Prueba con otro fragmento.";
 return va?"No hem pogut completar la resposta. Els teus avanços estan guardats; pots tornar-ho a provar.":"No hemos podido completar la respuesta. Tus avances están guardados; puedes volver a intentarlo.";
}
