import { createDemoWallet } from "./demo-unicoins";
import { emptyWallet } from "./unicoins";
import type { Locale } from "../i18n/routes";
import type { CommunityRepository, CommunityData, Message, Profile, RelationshipStatus, ShowcaseItem, Sticker } from "./types";
import { requireText, showcaseMedia, validateChatMedia, validateGroup, validatePdf, validatePlan, validateProfile, validateShowcase } from "./validation";
import { showcaseFrames, showcaseLimits, type ShowcaseFrame } from "./showcase";
import { builtinStickerUrl, builtinStickers, defaultSpace, stickerLimits, validatePlacement, validateSpace, type ProfileSpace } from "./space";
import { localTaste, type Taste } from "./tastes";
import { faceLimits, type FaceKind } from "./images";
import { demoAnswer, demoNoteStudy } from "./study";

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
 // Enough overlap between the example people for "lo que tenéis en común" to
 // have something to show, and gaps in Álex's shelf so the empty slots invite.
 const shelfById:Record<string,{favorites:Taste[];picks:string[]}>={
  [demoUserId]:{favorites:[localTaste("tv","La que se avecina"),localTaste("tv","Arcane",true),localTaste("film","Parásitos"),localTaste("game","Mario Kart")],picks:["madrugar","biblioteca","horchata","bus","al-dia","auriculares"]},
  "demo-paula":{favorites:[localTaste("tv","Arcane"),localTaste("film","El viaje de Chihiro",true),localTaste("film","Parásitos"),localTaste("music","Rigoberta Bandini"),localTaste("game","Stardew Valley")],picks:["trasnochar","cocina","cafe","mano","bici","playa","maraton","auriculares"]},
  "demo-marc":{favorites:[localTaste("tv","La que se avecina",true),localTaste("film","Campeones"),localTaste("game","FIFA"),localTaste("music","Estopa")],picks:["madrugar","biblioteca","horchata","bus","salir","altavoz","menu","contesto"]},
  "demo-laia":{favorites:[localTaste("tv","Euphoria"),localTaste("film","La La Land"),localTaste("film","Parásitos",true),localTaste("music","Zahara"),localTaste("music","Rosalía")],picks:["trasnochar","cocina","cafe","tablet","playa","capitulo","sofa","silenciado"]},
  "demo-nico":{favorites:[localTaste("tv","Dark"),localTaste("game","Elden Ring",true),localTaste("game","Hollow Knight"),localTaste("game","Mario Kart"),localTaste("music","Arctic Monkeys")],picks:["trasnochar","cocina","cafe","tablet","bici","ultima-noche","auriculares","silenciado"]},
  "demo-aina":{favorites:[localTaste("tv","Bluey"),localTaste("film","El viaje de Chihiro"),localTaste("music","Vetusta Morla",true),localTaste("game","Animal Crossing")],picks:["madrugar","biblioteca","cafe","mano","bici","montana","al-dia","tupper"]},
 };
 const avatarById:Record<string,string>={
  [demoUserId]:"/avatars/alex.svg",
  "demo-paula":"/avatars/paula.svg",
  "demo-marc":"/avatars/marc.svg",
  "demo-laia":"/avatars/laia.svg",
  "demo-nico":"/avatars/nico.svg",
  "demo-aina":"/avatars/aina.svg",
 };
 const profiles:Profile[]=people.map(([id,name,campus,degree,color,bio,interests,relationship_status],i)=>({user_id:id,name,campus,degree,color,bio,interests,relationship_status,favorites:shelfById[id]?.favorites??[],picks:shelfById[id]?.picks??[],avatar_url:avatarById[id],university:campus==="Vera"?"Universitat Politècnica de València":"Universitat de València",year:2+i%3,created_at:ago(48+i)}));
 const data:CommunityData={profiles,wallet:emptyWallet(),
  posts:[
   {id:"post-paula",author_id:"demo-paula",body:l("El grupo de WhatsApp lleva tres semanas diciendo «a ver si quedamos».\nHe reservado la tarde. Café en Benimaclet, cuadernos fuera y móviles boca abajo. El plan está en Planes. ☕","El grup de WhatsApp fa tres setmanes que diu «a vore si quedem».\nM’he guardat la vesprada. Café a Benimaclet, llibretes fora i mòbils cap per avall. El pla està en Plans. ☕"),kind:"post",group_id:null,created_at:ago(1)},
   {id:"post-laia",author_id:"demo-laia",body:l("Pregunta seria: ¿alguien más entiende mejor el tema 4 cuando se lo explica otra persona? Busco compi de estudio en Blasco esta semana.","Pregunta seriosa: algú més entén millor el tema 4 quan li l’explica una altra persona? Busque companyia per a estudiar a Blasco esta setmana."),kind:"question",group_id:"group-study",created_at:ago(3)},
   {id:"post-marc",author_id:"demo-marc",body:l("Salimos de clase para ir a casa. Acabamos cruzando el campus sin mirar la hora. Esto también debería dar créditos.","Eixim de classe per a anar a casa. Acabem travessant el campus sense mirar l’hora. Açò també hauria de donar crèdits."),kind:"post",group_id:null,image_url:"/images/campus-feed.webp",created_at:ago(5)},
   {id:"post-nico",author_id:"demo-nico",body:l("Tengo una idea a medias y un café entero. ¿Alguien de diseño para montar un proyecto pequeño en Vera? Cero discursos de emprendedor. Prometido.","Tinc una idea a mitges i un café sencer. Algú de disseny per a muntar un projecte menut a Vera? Cap discurs d’emprenedor. Promés."),kind:"question",group_id:"group-build",created_at:ago(9)},
   {id:"post-aina",author_id:"demo-aina",body:l("Atardecer en l’Albufera el jueves. Salgo desde Burjassot y hay sitio en el coche para tres.\nNo hace falta saber de pájaros. Solo mirar.","Posta de sol a l’Albufera dijous. Ixc des de Burjassot i hi ha lloc al cotxe per a tres.\nNo cal saber de pardals. Només mirar."),kind:"post",group_id:"group-outside",created_at:ago(2)},
   {id:"post-marc-outside",author_id:"demo-marc",body:l("Pachanga en Tarongers los martes a las 19h. Venimos de cinco carreras distintas y nadie juega bien. Ese es el nivel.","Patxanga a Tarongers els dimarts a les 19h. Venim de cinc carreres diferents i ningú juga bé. Eixe és el nivell."),kind:"post",group_id:"group-outside",created_at:ago(14)},
   {id:"post-laia-study",author_id:"demo-laia",body:l("Montamos sala en la biblioteca de Blasco el miércoles de 16 a 20. Cada uno con su tema y descanso cada hora.\n¿Nos apuntamos seis o soy muy optimista?","Muntem sala a la biblioteca de Blasco dimecres de 16 a 20. Cadascú amb el seu tema i descans cada hora.\nMos apuntem sis o soc massa optimista?"),kind:"post",group_id:"group-study",created_at:ago(7)},
   {id:"post-alex-study",author_id:demoUserId,body:l("¿Alguien tiene los apuntes de macro del año pasado? Los míos acaban en el tema 2 y el examen no.","Algú té els apunts de macro de l’any passat? Els meus acaben al tema 2 i l’examen no."),kind:"question",group_id:"group-study",created_at:ago(20)},
   {id:"post-paula-build",author_id:"demo-paula",body:l("Busco a alguien que sepa de impresión 3D para una maqueta del proyecto final. Pago en horchata y créditos en el README.","Busque algú que sàpia d’impressió 3D per a una maqueta del projecte final. Pague en orxata i crèdits al README."),kind:"question",group_id:"group-build",created_at:ago(30)},
   {id:"post-nico-build",author_id:"demo-nico",body:l("Hemos terminado la primera versión del buscador de salas libres. Funciona regular, pero funciona.\nSi queréis romperlo, os paso el enlace.","Hem acabat la primera versió del buscador de sales lliures. Funciona regular, però funciona.\nSi voleu trencar-lo, vos passe l’enllaç."),kind:"post",group_id:"group-build",created_at:ago(46)},
   {id:"post-campus",author_id:"demo-marc",body:l("Aviso para quien vaya a la sede de Tarongers: la máquina de café de la primera planta lleva tres días comiéndose las monedas. La de la tercera va bien.","Avís per a qui vaja a la seu de Tarongers: la màquina de café de la primera planta fa tres dies que es menja les monedes. La de la tercera va bé."),kind:"post",group_id:null,created_at:ago(11)}
  ], comments:[
   {id:"comment1",post_id:"post-paula",author_id:"demo-marc",body:l("Móviles boca abajo. Esa es la parte difícil 😂","Mòbils cap per avall. Eixa és la part difícil 😂"),created_at:ago(.5)},
   {id:"comment2",post_id:"post-laia-study",author_id:demoUserId,body:l("Me apunto. Llevo cafeína para todos.","M’apunte. Porte cafeïna per a tots."),created_at:ago(6)},
   {id:"comment3",post_id:"post-laia-study",author_id:"demo-aina",body:l("Yo caigo a las 17h, que salgo de prácticas.","Jo caic a les 17h, que ixc de pràctiques."),created_at:ago(5)},
   {id:"comment4",post_id:"post-laia-study",author_id:"demo-nico",body:l("Si queda sitio, me llevo el portátil y no molesto.","Si queda lloc, m’emporte el portàtil i no moleste."),created_at:ago(4)},
   {id:"comment5",post_id:"post-aina",author_id:"demo-laia",body:l("Yo voy. Llevo la cámara por si acaso.","Jo vaig. Porte la càmera per si de cas."),created_at:ago(1.5)},
   {id:"comment6",post_id:"post-aina",author_id:"demo-paula",body:l("¿Queda sitio para una cuarta? Pregunto por mí.","Queda lloc per a una quarta? Pregunte per mi."),created_at:ago(1)},
   {id:"comment7",post_id:"post-nico-build",author_id:demoUserId,body:l("Lo he roto en dos minutos. Te paso capturas.","L’he trencat en dos minuts. Et passe captures."),created_at:ago(40)},
   {id:"comment8",post_id:"post-alex-study",author_id:"demo-laia",body:l("Tengo los del año pasado escaneados. Están en Campus.","Tinc els de l’any passat escanejats. Estan en Campus."),created_at:ago(18)}
  ],
  likes:[
   {post_id:"post-paula",user_id:"demo-laia"},{post_id:"post-paula",user_id:"demo-marc"},{post_id:"post-marc",user_id:demoUserId},
   {post_id:"post-aina",user_id:demoUserId},{post_id:"post-aina",user_id:"demo-laia"},{post_id:"post-aina",user_id:"demo-paula"},{post_id:"post-aina",user_id:"demo-marc"},{post_id:"post-aina",user_id:"demo-nico"},
   {post_id:"post-nico-build",user_id:"demo-paula"},{post_id:"post-nico-build",user_id:"demo-laia"},{post_id:"post-nico-build",user_id:"demo-aina"},{post_id:"post-nico-build",user_id:demoUserId},
   {post_id:"post-laia-study",user_id:"demo-aina"},{post_id:"post-laia-study",user_id:"demo-nico"},
   {post_id:"post-campus",user_id:"demo-laia"},{post_id:"post-campus",user_id:"demo-nico"},{post_id:"post-campus",user_id:"demo-aina"},
   {post_id:"post-marc-outside",user_id:demoUserId}
  ],
  signals:[
   {post_id:"post-aina",user_id:"demo-laia",kind:"in"},{post_id:"post-aina",user_id:"demo-paula",kind:"in"},{post_id:"post-aina",user_id:"demo-marc",kind:"in"},
   {post_id:"post-laia-study",user_id:"demo-aina",kind:"in"},{post_id:"post-laia-study",user_id:"demo-nico",kind:"in"},
   {post_id:"post-paula",user_id:"demo-marc",kind:"in"},{post_id:"post-marc-outside",user_id:"demo-nico",kind:"in"},
   {post_id:"post-laia",user_id:"demo-marc",kind:"same"},{post_id:"post-laia",user_id:"demo-aina",kind:"same"},{post_id:"post-laia",user_id:"demo-nico",kind:"help"},
   {post_id:"post-alex-study",user_id:"demo-marc",kind:"same"},{post_id:"post-alex-study",user_id:"demo-laia",kind:"help"},
   {post_id:"post-paula-build",user_id:"demo-nico",kind:"help"},{post_id:"post-nico",user_id:"demo-paula",kind:"help"}
  ],
  groups:[
   {id:"group-study",creator_id:"demo-laia",name:l("Los del tema 4","Els del tema 4"),description:l("Apuntes, dudas y compañía para estudiar. Nadie nace sabiendo estadística.","Apunts, dubtes i companyia per a estudiar. Ningú naix sabent estadística."),category:"study",campus:"Blasco Ibáñez",is_private:false,share_token:"demo-share-group-study",created_at:ago(100)},
   {id:"group-outside",creator_id:"demo-marc",name:l("Nos vemos fuera","Ens veiem fora"),description:l("El Turia, la playa o donde caiga. Hay vida después de las prácticas.","El Túria, la platja o on siga. Hi ha vida després de les pràctiques."),category:"leisure",campus:"Tarongers",is_private:false,share_token:"demo-share-group-outside",created_at:ago(90)},
   {id:"group-build",creator_id:"demo-nico",name:l("Gente que hace cosas","Gent que fa coses"),description:l("Una idea, distintas carreras y ganas de probar. Empezamos en Vera.","Una idea, carreres diferents i ganes de provar. Comencem a Vera."),category:"projects",campus:"Vera",is_private:false,share_token:"demo-share-group-build",created_at:ago(80)}
  ],groupMembers:[{group_id:"group-study",user_id:"demo-laia"},{group_id:"group-study",user_id:demoUserId},{group_id:"group-outside",user_id:"demo-marc"},{group_id:"group-outside",user_id:"demo-aina"},{group_id:"group-build",user_id:"demo-nico"},{group_id:"group-build",user_id:"demo-paula"}],
  plans:[
   {id:"plan-coffee",creator_id:"demo-paula",title:l("Un café. Cero excusas.","Un café. Cap excusa."),description:l("Nos conocemos, hablamos de todo menos de entregas y elegimos sitio para tomar café por el barrio.","Ens coneixem, parlem de tot menys d’entregues i triem lloc per a prendre café pel barri."),place:"Benimaclet",meeting_point:l("En la plaza de Benimaclet, junto a la fuente.","A la plaça de Benimaclet, al costat de la font."),starts_at:later(25),capacity:8,created_at:ago(5)},
   {id:"plan-turia",creator_id:"demo-marc",title:l("Paseo por el Turia y lo que surja","Passeig pel Túria i el que vinga"),description:l("Calzado cómodo. Ritmo de conversación. Bajamos al jardín desde las Torres.","Calçat còmode. Ritme de conversa. Baixem al jardí des de les Torres."),place:"Torres de Serranos",meeting_point:l("Delante de las Torres, en la plaza dels Furs.","Davant de les Torres, a la plaça dels Furs."),starts_at:later(49),capacity:10,created_at:ago(10)},
   {id:"plan-beach",creator_id:"demo-laia",title:l("La última luz en la Malvarrosa","L’última llum a la Malva-rosa"),description:l("Manta, algo de picar y ganas de hablar. Cada cual trae lo suyo.","Manta, alguna cosa per a picar i ganes de parlar. Cadascú porta el que vulga."),place:"La Malvarrosa",meeting_point:l("Paseo marítimo, frente a la Casa Museo Blasco Ibáñez.","Passeig marítim, davant de la Casa Museu Blasco Ibáñez."),starts_at:later(73),capacity:12,created_at:ago(12)},
   {id:"plan-albufera",creator_id:"demo-aina",title:l("L’Albufera no tiene filtro","L’Albufera no té filtre"),description:l("Quedamos para ver la puesta de sol. Organizamos el transporte entre quienes se apunten.","Quedem per a vore la posta de sol. Organitzem el transport entre qui s’apunte."),place:"L’Albufera · Gola de Pujol",meeting_point:l("En el mirador de la Gola de Pujol.","Al mirador de la Gola de Pujol."),starts_at:later(97),capacity:6,created_at:ago(18)},
   {id:"plan-project",creator_id:demoUserId,title:l("Ideas en una servilleta","Idees en un tovalló"),description:l("Una hora para contar ese proyecto que lleva meses en tu cabeza.","Una hora per a contar eixe projecte que fa mesos que tens al cap."),place:"Campus de Vera · Ágora",meeting_point:l("Bajo el reloj del Ágora.","Davall del rellotge de l’Àgora."),starts_at:later(121),capacity:6,created_at:ago(20)}
  ],planMembers:[{plan_id:"plan-coffee",user_id:"demo-paula"},{plan_id:"plan-coffee",user_id:"demo-marc"},{plan_id:"plan-turia",user_id:"demo-marc"},{plan_id:"plan-turia",user_id:demoUserId},{plan_id:"plan-beach",user_id:"demo-laia"},{plan_id:"plan-albufera",user_id:"demo-aina"},{plan_id:"plan-project",user_id:demoUserId}],
  notes:[{id:"note1",author_id:"demo-laia",title:l("Estadística. Guía para empezar.","Estadística. Guia per a començar."),subject:l("Estadística","Estadística"),description:l("Un esquema de ejemplo para organizar la asignatura.","Un esquema d’exemple per a organitzar l’assignatura."),campus:"Blasco Ibáñez",file_name:"guia-estadistica-ejemplo.txt",file_path:"demo/note1",file_size:0,created_at:ago(8)},{id:"note2",author_id:"demo-nico",title:l("Antes de programar","Abans de programar"),subject:l("Programación","Programació"),description:l("Lista de ejemplo para pensar un problema antes de escribir código.","Llista d’exemple per a pensar un problema abans d’escriure codi."),campus:"Vera",file_name:"guia-programacion-ejemplo.txt",file_path:"demo/note2",file_size:0,created_at:ago(26)}],
  // Stickers on the covers: two on Álex's, one on Paula's, all shipped ones.
  stickers:[
   {id:"st-alex-cafe",owner_id:demoUserId,path:"builtin:cafe",url:builtinStickerUrl("cafe"),x:13,y:34,scale:1.1,rotation:-8,z:1,created_at:ago(100)},
   {id:"st-alex-hola",owner_id:demoUserId,path:"builtin:hola",url:builtinStickerUrl("hola"),x:85,y:26,scale:1,rotation:6,z:2,created_at:ago(99)},
   {id:"st-paula-planta",owner_id:"demo-paula",path:"builtin:planta",url:builtinStickerUrl("planta"),x:88,y:66,scale:1.2,rotation:0,z:1,created_at:ago(80)},
  ] as Sticker[],
  // The showcases. Álex owns four; the others cover every audience so the demo
  // shows what a viewer is and is not handed. Álex has chatted with Paula and
  // shares a campus with Marc; Laia chose Álex by hand.
  showcase:[
   {id:"sc-alex-yt",owner_id:demoUserId,kind:"link",title:l("El vídeo que le pongo a todo el mundo","El vídeo que li pose a tothom"),body:l("Diez minutos que explican mejor la macro que todo el tema 2.","Deu minuts que expliquen millor la macro que tot el tema 2."),url:"https://www.youtube.com/watch?v=aircAruvnKk",audience:"everyone",viewers:[],position:0,created_at:ago(30)},
   {id:"sc-alex-note",owner_id:demoUserId,kind:"note",title:l("Regla de la semana","Regla de la setmana"),body:l("Un café con alguien nuevo cada jueves. Sin excusas y sin agenda.","Un café amb algú nou cada dijous. Sense excuses i sense agenda."),audience:"campus",viewers:[],position:1,created_at:ago(50)},
   {id:"sc-alex-story",owner_id:demoUserId,kind:"story",title:l("Turia, 19:40","Túria, 19:40"),body:l("Salimos de clase para ir a casa. Acabamos aquí.","Eixim de classe per a anar a casa. Acabem ací."),media_path:"/images/campus-walk.webp",media_kind:"image",media_url:"/images/campus-walk.webp",audience:"contacts",viewers:[],position:2,created_at:ago(70)},
   {id:"sc-alex-file",owner_id:demoUserId,kind:"file",title:l("Macro · esquema del tema 3","Macro · esquema del tema 3"),body:l("Solo para mí, de momento. Cuando esté limpio lo abro.","Només per a mi, de moment. Quan estiga net l’òbric."),media_path:"demo/showcase-apuntes",media_kind:"pdf",audience:"only_me",viewers:[],position:3,created_at:ago(90)},
   {id:"sc-paula-yt",owner_id:"demo-paula",kind:"link",title:l("Cómo se dibuja una silla","Com es dibuixa una cadira"),body:"",url:"https://youtu.be/9bZkp7q19f0",audience:"everyone",viewers:[],position:0,created_at:ago(20)},
   {id:"sc-paula-story",owner_id:"demo-paula",kind:"story",title:l("Benimaclet, jueves","Benimaclet, dijous"),body:l("Cuadernos fuera, móviles boca abajo.","Quaderns fora, mòbils cap per avall."),media_path:"/images/campus.webp",media_kind:"image",media_url:"/images/campus.webp",audience:"contacts",viewers:[],position:1,created_at:ago(40)},
   {id:"sc-paula-note",owner_id:"demo-paula",kind:"note",title:l("Ideas que no enseño","Idees que no mostre"),body:l("Todavía no.","Encara no."),audience:"only_me",viewers:[],position:2,created_at:ago(60)},
   {id:"sc-nico-link",owner_id:"demo-nico",kind:"link",title:l("Lo que estoy construyendo","El que estic construint"),body:l("Código abierto. Se acepta que lo rompas.","Codi obert. S’accepta que el trenques."),url:"https://github.com/entreclases",audience:"everyone",viewers:[],position:0,created_at:ago(25)},
   {id:"sc-nico-note",owner_id:"demo-nico",kind:"note",title:l("Solo para Vera","Només per a Vera"),body:l("Jueves en el Ágora, 17:00. Traed portátil.","Dijous a l’Àgora, 17:00. Porteu portàtil."),audience:"campus",viewers:[],position:1,created_at:ago(35)},
   {id:"sc-laia-note",owner_id:"demo-laia",kind:"note",title:l("Para Álex","Per a Àlex"),body:l("El tema 4 te lo explico yo. Martes, biblioteca de Blasco.","El tema 4 t’ho explique jo. Dimarts, biblioteca de Blasco."),audience:"chosen",viewers:[demoUserId],position:0,created_at:ago(12)},
   {id:"sc-marc-note",owner_id:"demo-marc",kind:"note",title:l("Pachanga de los viernes","Patxanga dels divendres"),body:l("18:30, pistas de Tarongers. Se juega a lo que salga.","18:30, pistes de Tarongers. Es juga al que isca."),audience:"everyone",viewers:[],position:0,created_at:ago(15)},
   {id:"sc-aina-media",owner_id:"demo-aina",kind:"media",title:l("Albufera, jueves pasado","Albufera, dijous passat"),body:"",media_path:"/images/campus.webp",media_kind:"image",media_url:"/images/campus.webp",audience:"everyone",viewers:[],position:0,created_at:ago(48)},
  ] as ShowcaseItem[],
  threads:[{id:"thread-paula",user_a:demoUserId,user_b:"demo-paula",created_at:ago(1)}]
 };
 const frameById:Record<string,ShowcaseFrame>={[demoUserId]:"madera","demo-paula":"cristal","demo-marc":"cristal","demo-laia":"madera","demo-nico":"neon","demo-aina":"neon"};
 data.profiles.forEach(p=>{p.showcase_frame=frameById[p.user_id]??"madera";});
 const spaceById:Record<string,ProfileSpace>={[demoUserId]:{...defaultSpace(),background:"cuaderno"},"demo-paula":{...defaultSpace(),background:"cielo"},"demo-nico":{...defaultSpace(),background:"noche",hidden:["picks"]}};
 data.profiles.forEach(p=>{p.space=spaceById[p.user_id]??defaultSpace();});
 const coins=createDemoWallet(data.planMembers.filter(m=>m.user_id===demoUserId).map(m=>m.plan_id),data.comments.filter(m=>m.author_id===demoUserId).map(m=>m.post_id));
 const texts:Record<string,string>={"demo/showcase-apuntes":l("ENTRECLASES · ESQUEMA DE EJEMPLO\n\nMacro, tema 3\n1. Oferta y demanda agregadas.\n2. Qué mueve cada curva.\n3. Tres ejemplos con números.\n\nNo es material oficial de ninguna asignatura.","ENTRECLASES · ESQUEMA D’EXEMPLE\n\nMacro, tema 3\n1. Oferta i demanda agregades.\n2. Què mou cada corba.\n3. Tres exemples amb números.\n\nNo és material oficial de cap assignatura."),"demo/note1":l("ENTRECLASE · DOCUMENTO DE EJEMPLO\n\nEstadística: por dónde empezar\n1. Identifica la población y la muestra.\n2. Clasifica las variables.\n3. Resume los datos con tablas y gráficos.\n4. Compara media, mediana y dispersión.\n5. Anota las dudas para compartirlas en el grupo.\n\nNo son apuntes oficiales ni material de una asignatura real.","ENTRECLASE · DOCUMENT D’EXEMPLE\n\nEstadística: per on començar\n1. Identifica la població i la mostra.\n2. Classifica les variables.\n3. Resumix les dades amb taules i gràfics.\n4. Compara mitjana, mediana i dispersió.\n5. Anota els dubtes per a compartir-los al grup.\n\nNo són apunts oficials ni material d’una assignatura real."),"demo/note2":l("ENTRECLASE · DOCUMENTO DE EJEMPLO\n\nAntes de programar\n1. Escribe el problema con tus palabras.\n2. Define entradas y salidas.\n3. Prueba un caso pequeño a mano.\n4. Divide el problema en pasos.\n5. Piensa qué debería pasar si no hay datos.\n\nMaterial ilustrativo de la demo.","ENTRECLASE · DOCUMENT D’EXEMPLE\n\nAbans de programar\n1. Escriu el problema amb les teues paraules.\n2. Definix entrades i eixides.\n3. Prova un cas menut a mà.\n4. Dividix el problema en passos.\n5. Pensa què hauria de passar si no hi ha dades.\n\nMaterial il·lustratiu de la demo.")};
 const files=new Map<string,Blob>(Object.entries(texts).map(([key,value])=>[key,new Blob([value],{type:"text/plain;charset=utf-8"})]));
 data.notes.forEach(note=>{note.file_size=files.get(note.file_path)!.size;});
 let chats:Message[]=[{id:"message1",thread_id:"thread-paula",sender_id:"demo-paula",body:l("¡Ey! He montado un café en Benimaclet. ¿Te vienes? ☕","Ei! He muntat un café a Benimaclet. Vens? ☕"),created_at:ago(1)}];
 const studied=new Set<string>();
 const urls=new Set<string>(), id=()=>crypto.randomUUID(), stamp=()=>new Date().toISOString();
 // What the database would hand a viewer: own pieces, then by audience.
 const visibleTo=(viewer:string)=>{
  const campusOf=(who:string)=>data.profiles.find(p=>p.user_id===who)?.campus;
  return (piece:ShowcaseItem)=>piece.owner_id===viewer||piece.audience==="everyone"
   ||(piece.audience==="campus"&&campusOf(piece.owner_id)===campusOf(viewer))
   ||(piece.audience==="contacts"&&data.threads.some(t=>(t.user_a===piece.owner_id&&t.user_b===viewer)||(t.user_b===piece.owner_id&&t.user_a===viewer)))
   ||(piece.audience==="chosen"&&piece.viewers.includes(viewer));
 };
 return {
  async read(){return structuredClone({...data,showcase:data.showcase.filter(visibleTo(demoUserId)),wallet:coins.snapshot()});},
  // The demo keeps the picture in the tab: an object URL that lives as long as
  // the visit, so nothing of yours is ever uploaded from the example profile.
  async saveFace(kind:FaceKind,image:Blob|null){
   const me=data.profiles[0];const field=kind==="avatar"?"avatar_url":"banner_url";
   const current=me[field];
   if(image&&(image.size>faceLimits.output||image.type!=="image/webp"))throw {code:"invalid_image"};
   if(current?.startsWith("blob:"))URL.revokeObjectURL(current);
   const next={...me,[field]:image?URL.createObjectURL(image):undefined};
   data.profiles[0]=next;
   return structuredClone({...next});
  },
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
  async signal(postId,kind,on){data.signals=data.signals.filter(s=>s.post_id!==postId||s.user_id!==demoUserId||s.kind!==kind);if(on)data.signals.push({post_id:postId,user_id:demoUserId,kind});},
  async like(postId,on){data.likes=data.likes.filter(p=>p.post_id!==postId||p.user_id!==demoUserId);if(on)data.likes.push({post_id:postId,user_id:demoUserId});},
  async comment(postId,body){requireText(body,1,600);const post=data.posts.find(p=>p.id===postId);if(!post)throw{code:"validation"};data.comments.push({id:id(),post_id:postId,author_id:demoUserId,body:body.trim(),created_at:stamp()});if(post.author_id!==demoUserId)coins.reward("reply_thread",postId,post.body);},
  async createPlan(input,requestId){validatePlan(input);const key=requestId??id(),existing=data.plans.find(p=>p.id===key);if(existing){if(existing.creator_id===demoUserId&&Object.entries(input).every(([k,v])=>existing[k as keyof typeof existing]===v))return;throw{message:"UNICOINS_REQUEST_USED"};}coins.spend("create_event",key,input.title);data.plans.push({...input,id:key,creator_id:demoUserId,created_at:stamp()});data.planMembers.push({plan_id:key,user_id:demoUserId});},
  async joinPlan(planId,join){const p=data.plans.find(p=>p.id===planId);if(!p)throw{code:"validation"};if(new Date(p.starts_at).getTime()<=Date.now())throw{message:"PLAN_PAST"};if(!join&&p.creator_id===demoUserId)throw{code:"validation"};const has=data.planMembers.some(m=>m.plan_id===planId&&m.user_id===demoUserId);if(join&&!has&&data.planMembers.filter(m=>m.plan_id===planId).length>=p.capacity)throw{message:"PLAN_FULL"};data.planMembers=data.planMembers.filter(m=>m.plan_id!==planId||m.user_id!==demoUserId);if(join){data.planMembers.push({plan_id:planId,user_id:demoUserId});if(!has&&p.creator_id!==demoUserId)coins.reward("join_event",planId,p.title);}},
  async removePlan(planId){if(!data.plans.some(p=>p.id===planId&&p.creator_id===demoUserId))throw{code:"validation"};data.plans=data.plans.filter(p=>p.id!==planId);data.planMembers=data.planMembers.filter(p=>p.plan_id!==planId);},
  async createGroup(input){validateGroup(input);const key=id();data.groups.unshift({...input,id:key,creator_id:demoUserId,share_token:id(),created_at:stamp()});data.groupMembers.push({group_id:key,user_id:demoUserId});},
  async joinGroup(groupId,join,shareToken){const group=data.groups.find(g=>g.id===groupId);if(!group)throw{code:"validation"};if(join&&group.is_private&&!data.groupMembers.some(m=>m.group_id===groupId&&m.user_id===demoUserId)&&shareToken!==group.share_token)throw{message:"PRIVATE_GROUP_INVITE_REQUIRED"};if(!join&&group.creator_id===demoUserId)throw{code:"validation"};data.groupMembers=data.groupMembers.filter(m=>m.group_id!==groupId||m.user_id!==demoUserId);if(join)data.groupMembers.push({group_id:groupId,user_id:demoUserId});},
  async uploadNote(input,file){requireText(input.title,3,100);requireText(input.subject,2,100);await validatePdf(file);const key=id();files.set(key,file);data.notes.unshift({...input,id:key,author_id:demoUserId,file_name:file.name,file_path:key,file_size:file.size,created_at:stamp()});},
  async downloadNote(note){const file=files.get(note.file_path);if(!file)throw{code:"invalid_file"};const url=URL.createObjectURL(file);urls.add(url);return url;},
  // En la demo la IA no se llama: preparar un apunte da el estudio de ejemplo y dura esta visita.
  async readStudy(noteId){return studied.has(noteId)?demoNoteStudy(locale):null;},
  async prepareStudy(noteId){if(!data.notes.some(n=>n.id===noteId))throw{message:"STUDY_NOT_FOUND"};await new Promise(done=>setTimeout(done,900));studied.add(noteId);return demoNoteStudy(locale);},
  async meetGamesOpen(){return true;},
  async warmups(){return [];},
  async askNote(noteId,question){requireText(question,3,400);if(!studied.has(noteId))throw{message:"STUDY_NOT_READY"};await new Promise(done=>setTimeout(done,600));return demoAnswer(locale);},
  async removeNote(note){if(note.author_id!==demoUserId)throw{code:"validation"};data.notes=data.notes.filter(n=>n.id!==note.id);files.delete(note.file_path);},
  async openThread(peerId){if(peerId===demoUserId||!data.profiles.some(p=>p.user_id===peerId))throw{message:"PEER_UNAVAILABLE"};let thread=data.threads.find(t=>t.user_a===peerId||t.user_b===peerId);if(!thread){thread={id:id(),user_a:demoUserId,user_b:peerId,created_at:stamp()};data.threads.unshift(thread);}return thread.id;},
  async messages(threadId){return structuredClone(chats.filter(m=>m.thread_id===threadId));},
  // In the demo a file never leaves the browser: it is shown from an object URL for this visit only.
  async sendMessage(threadId,body,file){const media=file?validateChatMedia(file):null;requireText(body,media?0:1,2000);if(!data.threads.some(t=>t.id===threadId))throw{code:"validation"};chats.push({id:id(),thread_id:threadId,sender_id:demoUserId,body:body.trim(),...(file&&media?{media_path:file.name,media_kind:media.kind,media_url:URL.createObjectURL(file)}:{}),created_at:stamp()});},
  async saveShowcaseFrame(frame){if(!showcaseFrames.includes(frame))throw{code:"validation"};data.profiles[0]={...data.profiles[0],showcase_frame:frame};return structuredClone(data.profiles[0]);},
  async addShowcaseItem(input,file){
   validateShowcase(input);
   const needsFile=input.kind==="story"||input.kind==="media"||input.kind==="file";
   if(needsFile!==!!file)throw{code:"validation"};
   if(data.showcase.filter(p=>p.owner_id===demoUserId).length>=showcaseLimits.pieces)throw{code:"validation"};
   let media_path:string|null=null,media_kind:ShowcaseItem["media_kind"]=null,media_url:string|undefined;
   if(file){
    const media=await showcaseMedia(input.kind,file);media_kind=media.kind;
    if(media.kind==="pdf"){media_path="demo/"+id();files.set(media_path,file);}
    else{media_url=URL.createObjectURL(file);urls.add(media_url);media_path=media_url;}
   }
   const piece:ShowcaseItem={id:id(),owner_id:demoUserId,kind:input.kind,title:input.title.trim(),body:input.body.trim(),url:input.kind==="link"?input.url:null,media_path,media_kind,media_url,audience:input.audience,viewers:input.audience==="chosen"?[...input.viewers]:[],position:0,created_at:stamp()};
   data.showcase.unshift(piece);return structuredClone(piece);
  },
  async updateShowcaseItem(pieceId,patch){
   const index=data.showcase.findIndex(p=>p.id===pieceId&&p.owner_id===demoUserId);if(index<0)throw{code:"validation"};
   const next={...data.showcase[index],...patch};
   validateShowcase({kind:next.kind,title:next.title,body:next.body,url:next.url??undefined,audience:next.audience,viewers:next.viewers});
   next.title=next.title.trim();next.body=next.body.trim();if(next.audience!=="chosen")next.viewers=[];
   data.showcase[index]=next;return structuredClone(next);
  },
  async removeShowcaseItem(item){
   if(item.owner_id!==demoUserId)throw{code:"validation"};
   const piece=data.showcase.find(p=>p.id===item.id);if(!piece)return;
   if(piece.media_url?.startsWith("blob:")){URL.revokeObjectURL(piece.media_url);urls.delete(piece.media_url);}
   if(piece.media_path)files.delete(piece.media_path);
   data.showcase=data.showcase.filter(p=>p.id!==item.id);
  },
  async openShowcaseFile(item){
   const file=item.media_path?files.get(item.media_path):undefined;
   if(file){const url=URL.createObjectURL(file);urls.add(url);return url;}
   if(item.media_url)return item.media_url;
   throw{code:"invalid_file"};
  },
  async saveSpace(space){validateSpace(space);data.profiles[0]={...data.profiles[0],space:structuredClone(space)};return structuredClone(data.profiles[0]);},
  async addSticker(source,placement){
   validatePlacement(placement);
   if(data.stickers.filter(s=>s.owner_id===demoUserId).length>=stickerLimits.count)throw{message:"STICKER_LIMIT"};
   let path:string,url:string;
   if(typeof source==="string"){if(!builtinStickers.includes(source))throw{code:"validation"};path="builtin:"+source;url=builtinStickerUrl(source);}
   else{if(source.size>stickerLimits.output||source.type!=="image/webp")throw{code:"invalid_image"};url=URL.createObjectURL(source);urls.add(url);path=url;}
   const sticker:Sticker={id:id(),owner_id:demoUserId,path,url,...placement,created_at:stamp()};
   data.stickers.push(sticker);return structuredClone(sticker);
  },
  async moveSticker(stickerId,placement){validatePlacement(placement);const index=data.stickers.findIndex(s=>s.id===stickerId&&s.owner_id===demoUserId);if(index<0)throw{code:"validation"};data.stickers[index]={...data.stickers[index],...placement};return structuredClone(data.stickers[index]);},
  async removeSticker(sticker){if(sticker.owner_id!==demoUserId)throw{code:"validation"};const found=data.stickers.find(s=>s.id===sticker.id);if(found?.url?.startsWith("blob:")){URL.revokeObjectURL(found.url);urls.delete(found.url);}data.stickers=data.stickers.filter(s=>s.id!==sticker.id);},
  dispose(){urls.forEach(url=>URL.revokeObjectURL(url));urls.clear();files.clear();chats=[];}
 };
}
