import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../supabase/functions/_shared/study-openai.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function transport(fetch=()=>{throw new Error('Unexpected network request');}){const m={exports:{}};new Function('module','exports','Deno','fetch',code)(m,m.exports,{env:{get:key=>key==='OPENAI_API_KEY'?'test-only':undefined}},fetch);return m.exports;}
test('Luna uses Responses with server credentials and response storage disabled',async()=>{
 let called;const ai=transport(async(url,init)=>{called={url,init};return Response.json({status:'completed',output:[]});});
 await ai.requestAI({input:[{role:'user',content:'Sample'}]});
 assert.equal(called.url,'https://api.openai.com/v1/responses');
 const body=JSON.parse(called.init.body);assert.equal(body.model,'gpt-6-luna');assert.equal(body.store,false);assert.equal(body.reasoning.effort,'low');assert.equal(called.init.headers.authorization,'Bearer test-only');
});
test('Refusals, empty output and incomplete responses are never treated as a lesson',()=>{
 const ai=transport();for(const response of [{status:'incomplete',output:[]},{status:'completed',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}])assert.throws(()=>ai.outputText(response));
 assert.equal(ai.outputText({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Ready'}]}]}),'Ready');
});
test('Responses stream handles split UTF-8, CRLF and event boundaries',async()=>{
 const ai=transport(),encoder=new TextEncoder();const payload=encoder.encode('event: response.output_text.delta\r\ndata: {"type":"response.output_text.delta","delta":"explicación"}\r\n\r\ndata: {"type":"response.completed"}\n\ndata: [DONE]\n\n');
 const response=new Response(new ReadableStream({start(controller){for(let i=0;i<payload.length;i+=3)controller.enqueue(payload.slice(i,i+3));controller.close();}}));
 const events=[];for await(const event of ai.responseEvents(response))events.push(event);
 assert.deepEqual(events,[{type:'response.output_text.delta',delta:'explicación'},{type:'response.completed'}]);
});
test('Provider errors do not expose response bodies or credentials',async()=>{
 const ai=transport(async()=>new Response('secret upstream message',{status:429}));
 await assert.rejects(()=>ai.requestAI({}),error=>error.status===429&&!error.message.includes('secret'));
});
