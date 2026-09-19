import { createDemoWallet } from "./demo-unicoins";
import { emptyWallet } from "./unicoins";
import type { Locale } from "../i18n/routes";
import type { CommunityRepository, CommunityData, Message, Profile, RelationshipStatus } from "./types";
import { requireText, validateGroup, validatePdf, validatePlan, validateProfile } from "./validation";

export const demoUserId = "demo-alex";
export function createDemoRepository(locale: Locale): CommunityRepository {
 const l=(es:string,va:string)=>locale==="va"?va:es;
 const now=Date.now(), ago=(h:number)=>new Date(now-h*3600000).toISOString(), later=(h:number)=>new Date(now+h*3600000).toISOString();
 const people: [string,string,string,string,number,string,string[],RelationshipStatus][] = [
  [demoUserId,"Álex Torres","Tarongers",l("Economía","Economia"),0,l("Café después de clase. Y si hay sol, al Turia.","Café després de classe. I si fa sol, al Túria."),["Café","Deporte","Música"],"single"],
  ["demo-paula","Paula Martí","Vera",l("Diseño industrial","Disseny industrial"),1,l("Colecciono ideas en servilletas. Busco gente para hacerlas realidad.","Col·leccione idees en tovallons. Busque gent per a fer-les realitat."),["Arte","Proyectos","Café"],"seeing_someone"],
  ["demo-marc","Marc Ferrer","Tarongers",l("Derecho","Dret"),2,l("Una pachanga, una horchata y ya hemos arreglado la tarde.","Una patxanga, una orxata i ja hem arreglat la vesprada."),["Deporte","Naturaleza"],"in_relationship"],
  ["demo-laia","Laia Soler","Blasco Ibáñez",l("Psicología","Psicologia"),3,l("Cine de martes. Playa de viernes. Apuntes el resto.","Cine de dimarts. Platja de divendres. Apunts la resta."),["Cine","Música","Naturaleza"],"complicated"],
  ["demo-nico","Nico Vidal","Vera",l("Ingeniería informática","Enginyeria informàtica"),4,l("Programo cosas. Algunas hasta funcionan. ¿Montamos algo?","Programe coses. Algunes fins i tot funcionen. Muntem alguna cosa?"),["Tecnología","Proyectos","Café"],"prefer_not_to_say"],
  ["demo-aina","Aina Costa","Burjassot-Paterna",l("Biología","Biologia"),5,l("La mejor pantalla es un atardecer en l’Albufera.","La millor pantalla és una posta de sol a l’Albufera."),["Naturaleza","Arte"],"single"],
 ];
 const avatarById:Record<string,string>={
  [demoUserId]:"/avatars/alex.svg",
  "demo-paula":"/avatars/paula.svg",
  "demo-marc":"/avatars/marc.svg",
  "demo-laia":"/avatars/laia.svg",
  "demo-nico":"/avatars/nico.svg",
  "demo-aina":"/avatars/aina.svg",
 };
 const profiles:Profile[]=people.map(([id,name,campus,degree,color,bio,interests,relationship_status],i)=>({user_id:id,name,campus,degree,color,bio,interests,relationship_status,avatar_url:avatarById[id],university:campus==="Vera"?"Universitat Politècnica de València":"Universitat de València",year:2+i%3,created_at:ago(48+i)}));
 const data:CommunityData={profiles,wallet:emptyWallet(),
  posts:[
   {id:"post-paula",author_id:"demo-paula",body:l("El grupo de WhatsApp lleva tres semanas diciendo «a ver si quedamos».\nHe reservado la tarde. Café en Benimaclet, cuadernos fuera y móviles boca abajo. El plan está en Planes. ☕","El grup de WhatsApp fa tres setmanes que diu «a vore si quedem».\nM’he guardat la vesprada. Café a Benimaclet, llibretes fora i mòbils cap per avall. El pla està en Plans. ☕"),kind:"post",group_id:null,created_at:ago(1)},
   {id:"post-laia",author_id:"demo-laia",body:l("Pregunta seria: ¿alguien más entiende mejor el tema 4 cuando se lo explica otra persona? Busco compi de estudio en Blasco esta semana.","Pregunta seriosa: algú més entén millor el tema 4 quan li l’explica una altra persona? Busque companyia per a estudiar a Blasco esta setmana."),kind:"question",group_id:"group-study",created_at:ago(3)},
   {id:"post-marc",author_id:"demo-marc",body:l("Salimos de clase para ir a casa. Acabamos cruzando el campus sin mirar la hora. Esto también debería dar créditos.","Eixim de classe per a anar a casa. Acabem travessant el campus sense mirar l’hora. Açò també hauria de donar crèdits."),kind:"post",group_id:null,image_url:"/images/campus-feed.webp",created_at:ago(5)},
   {id:"post-nico",author_id:"demo-nico",body:l("Tengo una idea a medias y un café entero. ¿Alguien de diseño para montar un proyecto pequeño en Vera? Cero discursos de emprendedor. Prometido.","Tinc una idea a mitges i un café sencer. Algú de disseny per a muntar un projecte menut a Vera? Cap discurs d’emprenedor. Promés."),kind:"question",group_id:"group-build",created_at:ago(9)}
  ], comments:[{id:"comment1",post_id:"post-paula",author_id:"demo-marc",body:l("Móviles boca abajo. Esa es la parte difícil 😂","Mòbils cap per avall. Eixa és la part difícil 😂"),created_at:ago(.5)}],
  likes:[{post_id:"post-paula",user_id:"demo-laia"},{post_id:"post-paula",user_id:"demo-marc"},{post_id:"post-marc",user_id:demoUserId}],
  groups:[
   {id:"group-study",creator_id:"demo-laia",name:l("Los del tema 4","Els del tema 4"),description:l("Apuntes, dudas y compañía para estudiar. Nadie nace sabiendo estadística.","Apunts, dubtes i companyia per a estudiar. Ningú naix sabent estadística."),category:"study",campus:"Blasco Ibáñez",created_at:ago(100)},
   {id:"group-outside",creator_id:"demo-marc",name:l("Nos vemos fuera","Ens veiem fora"),description:l("El Turia, la playa o donde caiga. Hay vida después de las prácticas.","El Túria, la platja o on siga. Hi ha vida després de les pràctiques."),category:"leisure",campus:"Tarongers",created_at:ago(90)},
   {id:"group-build",creator_id:"demo-nico",name:l("Gente que hace cosas","Gent que fa coses"),description:l("Una idea, distintas carreras y ganas de probar. Empezamos en Vera.","Una idea, carreres diferents i ganes de provar. Comencem a Vera."),category:"projects",campus:"Vera",created_at:ago(80)}
  ],groupMembers:[{group_id:"group-study",user_id:"demo-laia"},{group_id:"group-study",user_id:demoUserId},{group_id:"group-outside",user_id:"demo-marc"},{group_id:"group-outside",user_id:"demo-aina"},{group_id:"group-build",user_id:"demo-nico"},{group_id:"group-build",user_id:"demo-paula"}],
  plans:[
   {id:"plan-coffee",creator_id:"demo-paula",title:l("Un café. Cero excusas.","Un café. Cap excusa."),description:l("Nos conocemos, hablamos de todo menos de entregas y elegimos sitio para tomar café por el barrio.","Ens coneixem, parlem de tot menys d’entregues i triem lloc per a prendre café pel barri."),place:"Benimaclet",meeting_point:l("En la plaza de Benimaclet, junto a la fuente.","A la plaça de Benimaclet, al costat de la font."),starts_at:later(25),capacity:8,created_at:ago(5)},
   {id:"plan-turia",creator_id:"demo-marc",title:l("Paseo por el Turia y lo que surja","Passeig pel Túria i el que vinga"),description:l("Calzado cómodo. Ritmo de conversación. Bajamos al jardín desde las Torres.","Calçat còmode. Ritme de conversa. Baixem al jardí des de les Torres."),place:"Torres de Serranos",meeting_point:l("Delante de las Torres, en la plaza dels Furs.","Davant de les Torres, a la plaça dels Furs."),starts_at:later(49),capacity:10,created_at:ago(10)},
   {id:"plan-beach",creator_id:"demo-laia",title:l("La última luz en la Malvarrosa","L’última llum a la Malva-rosa"),description:l("Manta, algo de picar y ganas de hablar. Cada cual trae lo suyo.","Manta, alguna cosa per a picar i ganes de parlar. Cadascú porta el que vulga."),place:"La Malvarrosa",meeting_point:l("Paseo marítimo, frente a la Casa Museo Blasco Ibáñez.","Passeig marítim, davant de la Casa Museu Blasco Ibáñez."),starts_at:later(73),capacity:12,created_at:ago(12)},
   {id:"plan-albufera",creator_id:"demo-aina",title:l("L’Albufera no tiene filtro","L’Albufera no té filtre"),description:l("Quedamos para ver la puesta de sol. Organizamos el transporte entre quienes se apunten.","Quedem per a vore la posta de sol. Organitzem el transport entre qui s’apunte."),place:"L’Albufera · Gola de Pujol",meeting_point:l("En el mirador de la Gola de Pujol.","Al mirador de la Gola de Pujol."),starts_at:later(97),capacity:6,created_at:ago(18)},
   {id:"plan-project",creator_id:demoUserId,title:l("Ideas en una servilleta","Idees en un tovalló"),description:l("Una hora para contar ese proyecto que lleva meses en tu cabeza.","Una hora per a contar eixe projecte que fa mesos que tens al cap."),place:"Campus de Vera · Ágora",meeting_point:l("Bajo el reloj del Ágora.","Davall del rellotge de l’Àgora."),starts_at:later(121),capacity:6,created_at:ago(20)}
  ],planMembers:[{plan_id:"plan-coffee",user_id:"demo-paula"},{plan_id:"plan-coffee",user_id:"demo-marc"},{plan_id:"plan-turia",user_id:"demo-marc"},{plan_id:"plan-turia",user_id:demoUserId},{plan_id:"plan-beach",user_id:"demo-laia"},{plan_id:"plan-albufera",user_id:"demo-aina"},{plan_id:"plan-project",user_id:demoUserId}],
  notes:[{id:"note1",author_id:"demo-laia",title:l("Estadística. Guía para empezar.","Estadística. Guia per a començar."),subject:l("Estadística","Estadística"),description:l("Un esquema de ejemplo para organizar la asignatura.","Un esquema d’exemple per a organitzar l’assignatura."),campus:"Blasco Ibáñez",file_name:"guia-estadistica-ejemplo.txt",file_path:"demo/note1",file_size:0,created_at:ago(8)},{id:"note2",author_id:"demo-nico",title:l("Antes de programar","Abans de programar"),subject:l("Programación","Programació"),description:l("Lista de ejemplo para pensar un problema antes de escribir código.","Llista d’exemple per a pensar un problema abans d’escriure codi."),campus:"Vera",file_name:"guia-programacion-ejemplo.txt",file_path:"demo/note2",file_size:0,created_at:ago(26)}],
  threads:[{id:"thread-paula",user_a:demoUserId,user_b:"demo-paula",created_at:ago(1)}]
 };
 const coins=createDemoWallet(data.planMembers.filter(m=>m.user_id===demoUserId).map(m=>m.plan_id),data.comments.filter(m=>m.author_id===demoUserId).map(m=>m.post_id));
 const texts:Record<string,string>={"demo/note1":l("ENTRECLASE · DOCUMENTO DE EJEMPLO\n\nEstadística: por dónde empezar\n1. Identifica la población y la muestra.\n2. Clasifica las variables.\n3. Resume los datos con tablas y gráficos.\n4. Compara media, mediana y dispersión.\n5. Anota las dudas para compartirlas en el grupo.\n\nNo son apuntes oficiales ni material de una asignatura real.","ENTRECLASE · DOCUMENT D’EXEMPLE\n\nEstadística: per on començar\n1. Identifica la població i la mostra.\n2. Classifica les variables.\n3. Resumix les dades amb taules i gràfics.\n4. Compara mitjana, mediana i dispersió.\n5. Anota els dubtes per a compartir-los al grup.\n\nNo són apunts oficials ni material d’una assignatura real."),"demo/note2":l("ENTRECLASE · DOCUMENTO DE EJEMPLO\n\nAntes de programar\n1. Escribe el problema con tus palabras.\n2. Define entradas y salidas.\n3. Prueba un caso pequeño a mano.\n4. Divide el problema en pasos.\n5. Piensa qué debería pasar si no hay datos.\n\nMaterial ilustrativo de la demo.","ENTRECLASE · DOCUMENT D’EXEMPLE\n\nAbans de programar\n1. Escriu el problema amb les teues paraules.\n2. Definix entrades i eixides.\n3. Prova un cas menut a mà.\n4. Dividix el problema en passos.\n5. Pensa què hauria de passar si no hi ha dades.\n\nMaterial il·lustratiu de la demo.")};
 const files=new Map<string,Blob>(Object.entries(texts).map(([key,value])=>[key,new Blob([value],{type:"text/plain;charset=utf-8"})]));
 data.notes.forEach(note=>{note.file_size=files.get(note.file_path)!.size;});
 let chats:Message[]=[{id:"message1",thread_id:"thread-paula",sender_id:"demo-paula",body:l("¡Ey! He montado un café en Benimaclet. ¿Te vienes? ☕","Ei! He muntat un café a Benimaclet. Vens? ☕"),created_at:ago(1)}];
 const urls=new Set<string>(), id=()=>crypto.randomUUID(), stamp=()=>new Date().toISOString();
 return {
  async read(){return structuredClone({...data,wallet:coins.snapshot()});},
  async saveProfile(input){validateProfile(input);const p={...data.profiles[0],...structuredClone(input)};data.profiles[0]=p;return structuredClone(p);},
  async publish(body,kind,groupId,requestId) {
   requireText(body,1,2000);
   if(groupId&&!data.groupMembers.some(m=>m.group_id===groupId&&m.user_id===demoUserId))throw{code:"validation"};
   const key=requestId??id(),existing=data.posts.find(p=>p.id===key);
   if(existing){if(existing.author_id===demoUserId&&existing.body===body.trim()&&existing.kind===kind&&existing.group_id===groupId)return;throw{message:"UNICOINS_REQUEST_USED"};}
   coins.spend("create_thread",key,body.trim());
   data.posts.unshift({id:key,author_id:demoUserId,body:body.trim(),kind,group_id:groupId,created_at:stamp()});
  },
  async removePost(postId){if(!data.posts.some(p=>p.id===postId&&p.author_id===demoUserId))throw{code:"validation"};data.posts=data.posts.filter(p=>p.id!==postId);data.comments=data.comments.filter(p=>p.post_id!==postId);data.likes=data.likes.filter(p=>p.post_id!==postId);},
  async like(postId,on){data.likes=data.likes.filter(p=>p.post_id!==postId||p.user_id!==demoUserId);if(on)data.likes.push({post_id:postId,user_id:demoUserId});},
  async comment(postId,body){requireText(body,1,600);const post=data.posts.find(p=>p.id===postId);if(!post)throw{code:"validation"};data.comments.push({id:id(),post_id:postId,author_id:demoUserId,body:body.trim(),created_at:stamp()});if(post.author_id!==demoUserId)coins.reward("reply_thread",postId,post.body);},
  async createPlan(input,requestId){validatePlan(input);const key=requestId??id(),existing=data.plans.find(p=>p.id===key);if(existing){if(existing.creator_id===demoUserId&&Object.entries(input).every(([k,v])=>existing[k as keyof typeof existing]===v))return;throw{message:"UNICOINS_REQUEST_USED"};}coins.spend("create_event",key,input.title);data.plans.push({...input,id:key,creator_id:demoUserId,created_at:stamp()});data.planMembers.push({plan_id:key,user_id:demoUserId});},
  async joinPlan(planId,join){const p=data.plans.find(p=>p.id===planId);if(!p)throw{code:"validation"};if(new Date(p.starts_at).getTime()<=Date.now())throw{message:"PLAN_PAST"};if(!join&&p.creator_id===demoUserId)throw{code:"validation"};const has=data.planMembers.some(m=>m.plan_id===planId&&m.user_id===demoUserId);if(join&&!has&&data.planMembers.filter(m=>m.plan_id===planId).length>=p.capacity)throw{message:"PLAN_FULL"};data.planMembers=data.planMembers.filter(m=>m.plan_id!==planId||m.user_id!==demoUserId);if(join){data.planMembers.push({plan_id:planId,user_id:demoUserId});if(!has&&p.creator_id!==demoUserId)coins.reward("join_event",planId,p.title);}},
  async removePlan(planId){if(!data.plans.some(p=>p.id===planId&&p.creator_id===demoUserId))throw{code:"validation"};data.plans=data.plans.filter(p=>p.id!==planId);data.planMembers=data.planMembers.filter(p=>p.plan_id!==planId);},
  async createGroup(input){validateGroup(input);const key=id();data.groups.unshift({...input,id:key,creator_id:demoUserId,created_at:stamp()});data.groupMembers.push({group_id:key,user_id:demoUserId});},
  async joinGroup(groupId,join){if(!join&&data.groups.some(g=>g.id===groupId&&g.creator_id===demoUserId))throw{code:"validation"};data.groupMembers=data.groupMembers.filter(m=>m.group_id!==groupId||m.user_id!==demoUserId);if(join)data.groupMembers.push({group_id:groupId,user_id:demoUserId});},
  async uploadNote(input,file){requireText(input.title,3,100);requireText(input.subject,2,100);await validatePdf(file);const key=id();files.set(key,file);data.notes.unshift({...input,id:key,author_id:demoUserId,file_name:file.name,file_path:key,file_size:file.size,created_at:stamp()});},
  async downloadNote(note){const file=files.get(note.file_path);if(!file)throw{code:"invalid_file"};const url=URL.createObjectURL(file);urls.add(url);return url;},
  async removeNote(note){if(note.author_id!==demoUserId)throw{code:"validation"};data.notes=data.notes.filter(n=>n.id!==note.id);files.delete(note.file_path);},
  async openThread(peerId){if(peerId===demoUserId||!data.profiles.some(p=>p.user_id===peerId))throw{message:"PEER_UNAVAILABLE"};let thread=data.threads.find(t=>t.user_a===peerId||t.user_b===peerId);if(!thread){thread={id:id(),user_a:demoUserId,user_b:peerId,created_at:stamp()};data.threads.unshift(thread);}return thread.id;},
  async messages(threadId){return structuredClone(chats.filter(m=>m.thread_id===threadId));},
  async sendMessage(threadId,body){requireText(body,1,2000);if(!data.threads.some(t=>t.id===threadId))throw{code:"validation"};chats.push({id:id(),thread_id:threadId,sender_id:demoUserId,body:body.trim(),created_at:stamp()});},
  dispose(){urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();files.clear();chats=[];}
 };
}
