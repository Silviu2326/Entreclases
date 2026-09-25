import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(path){const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('module','exports',code)(m,m.exports);return m.exports;}
const {validateLesson,validateSessionLesson,validateFeedback,validPreferences}=load('supabase/functions/_shared/learning.ts');
const {exampleLesson,sampleSource}=load('lib/community/student/learning-demo.ts');
const {emptyLearning,choiceCorrect,recordAnswer,finishSession,dueConcepts,nextSubject,compactHistory}=load('lib/community/student/learning.ts');
const lesson=exampleLesson('mixed',20);
const session=(id='a')=>({id,subjectId:'economics',subjectName:'Economía',createdAt:'2026-09-25T10:00:00.000Z',minutes:20,lesson,sources:[sampleSource],answers:{},current:0,interestContext:[]});
function answered(id='a',hinted=false){const s=session(id);lesson.activities.forEach((a,i)=>{s.answers[i]={answer:String(a.answer),correct:true,hinted,at:s.createdAt,feedback:{verdict:'correct',feedback:'Bien',nextQuestion:''}};});return s;}
test('All demo modes include their requested activity and verified source quotes',()=>{for(const va of [false,true])for(const mode of ['mixed','sprint','spot-error','teach','case','connect'])for(const minutes of [5,10,20]){const generated=exampleLesson(mode,minutes,va);assert.equal(validateLesson(generated,[sampleSource]),generated);if(!['mixed','sprint'].includes(mode))assert.ok(generated.activities.some(a=>a.kind===mode));}});
test('Reject nonexistent quotations, wrong source IDs and invalid answer/order indices',()=>{for(const patch of [{quote:'This quote does not exist in the material.'},{sourceId:'other'},{answer:99}]){const copy=structuredClone(lesson);Object.assign(copy.activities[0],patch);assert.throws(()=>validateLesson(copy,[sampleSource]));}const copy=structuredClone(lesson);const order=copy.activities.find(a=>a.kind==='connect');order.correctOrder=[0,0,1,2];assert.throws(()=>validateLesson(copy,[sampleSource]));});
test('Empty choices and incorrect orders never count as correct',()=>{assert.equal(choiceCorrect(lesson.activities[0],''),false);assert.equal(choiceCorrect(lesson.activities[0],'1'),true);const a=lesson.activities.find(a=>a.kind==='connect');assert.equal(choiceCorrect(a,a.correctOrder.join(',')),true);assert.equal(choiceCorrect(a,'0,1,2,3'),false);});
test('Progress is committed once; unfinished sessions cannot grant progress',()=>{let state={...structuredClone(emptyLearning),sessions:[session()],activeId:'a'};assert.equal(finishSession(state,'a'),state);state.sessions=[answered()];const done=finishSession(state,'a',new Date('2026-09-25T10:00:00Z'));assert.equal(done.activeId,null);assert.ok(done.sessions[0].completedAt);assert.equal(finishSession(done,'a'),done);assert.ok(done.concepts.every(c=>c.independentDays.length===1));});
test('Hints and repeated practice on the same day cannot inflate independent days',()=>{let state={...structuredClone(emptyLearning),sessions:[answered('a')]};state=finishSession(state,'a',new Date('2026-09-25T10:00:00Z'));state.sessions.push(answered('b'));state=finishSession(state,'b',new Date('2026-09-25T16:00:00Z'));assert.ok(state.concepts.every(c=>c.independentDays.length===1));state.sessions.push(answered('c',true));state=finishSession(state,'c',new Date('2026-09-26T10:00:00Z'));assert.ok(state.concepts.every(c=>c.independentDays.length===1&&c.lastOutcome==='review'));assert.equal(dueConcepts(state,new Date('2026-09-26T11:00:00Z')).length,0);assert.ok(dueConcepts(state,new Date('2026-09-27T11:00:00Z')).length>0);});
test('Answers cannot be replaced to farm progress',()=>{let state={...structuredClone(emptyLearning),sessions:[session()]};const wrong={answer:'0',correct:false,hinted:false,feedback:{verdict:'revisit',feedback:'Revisa',nextQuestion:''},at:'now'};state=recordAnswer(state,'a',0,wrong);state=recordAnswer(state,'a',0,{...wrong,correct:true});assert.equal(state.sessions[0].answers[0].correct,false);});
test('Recommendations work without exams and exclude archived subjects',()=>{const subjects=[{id:'archived',archived:true},{id:'a',name:'Tema de clase',examDate:''},{id:'b',name:'Trabajo',examDate:''}];assert.equal(nextSubject(subjects,emptyLearning).id,'a');const state={...emptyLearning,concepts:[{subjectId:'b',reviewAt:'2020-01-01'}]};assert.equal(nextSubject(subjects,state).id,'b');});
test('Preferences and feedback reject malformed model/browser values',()=>{assert.equal(validPreferences(emptyLearning.preferences),true);assert.equal(validPreferences({...emptyLearning.preferences,minutes:999}),false);assert.equal(validPreferences({...emptyLearning.preferences,interests:new Array(9).fill('a')}),false);assert.throws(()=>validateFeedback({verdict:'perfect',feedback:'x',nextQuestion:''}));});

test('Year-long history keeps recent detail, all summaries and in-progress sessions',()=>{
 const sessions=Array.from({length:365},(_,i)=>({...answered(String(i)),completedAt:new Date(Date.UTC(2025,0,i+1)).toISOString()}));
 const state={...structuredClone(emptyLearning),sessions:[session('unfinished'),...sessions],activeId:'unfinished'};
 const compact=compactHistory(state);
 assert.equal(compact.sessions.length,21);assert.equal(compact.archive.length,345);
 assert.equal(compact.activeId,'unfinished');assert.equal(compact.sessions[0].id,'unfinished');
 assert.equal(compactHistory(compact),compact);assert.ok(compact.archive.every(s=>s.activities===6&&!('sources' in s)));
});
test('Completion of another session preserves the current session',()=>{
 const state={...structuredClone(emptyLearning),sessions:[session('ongoing'),answered('done')],activeId:'ongoing'};
 assert.equal(finishSession(state,'done').activeId,'ongoing');
});
test('Requested session duration and mode must match the generated lesson',()=>{
 assert.equal(validateSessionLesson(lesson,[sampleSource],{...emptyLearning.preferences,minutes:20}),lesson);
 assert.throws(()=>validateSessionLesson(lesson,[sampleSource],{...emptyLearning.preferences,minutes:5}));
 const short=exampleLesson('mixed',5);assert.throws(()=>validateSessionLesson(short,[sampleSource],{...emptyLearning.preferences,minutes:5,mode:'teach'}));
 assert.equal(validPreferences({...emptyLearning.preferences,minutes:'10'}),false);
});
