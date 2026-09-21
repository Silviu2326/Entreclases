import type { GameKind } from "./types";

// One opening banner per experience. Inicio and Explorar show the same one all
// day and it changes at midnight; every banner ends in the page of its game.
type Text = readonly [string, string];
export type Opening = {
  headline: Text; highlight: Text; body: Text; note: Text;
  card: { label: Text; title: Text; prompt: Text; options: readonly Text[]; idle: Text; results: readonly Text[]; cta: Text };
};
export const openings: Record<GameKind, Opening> = {
  truth: {
    headline: ["Venías a mirar.", "Venies a mirar."], highlight: ["A ver cómo acabas.", "A vore com acabes."],
    body: ["Una partida, un café, gente que también se apunta. Tu siguiente anécdota puede empezar aquí.", "Una partida, un café, gent que també s’apunta. La teua pròxima anècdota pot començar ací."],
    note: ["el horario no lo es todo", "l’horari no ho és tot"],
    card: { label: ["UNA RONDA PARA CALENTAR", "UNA RONDA PER A ESCALFAR"], title: ["Aquí hay una trola.", "Ací hi ha una mentida."], prompt: ["Dos verdades. Una mentira. ¿Cuál no te crees?", "Dues veritats. Una mentida. Quina no et creus?"],
      options: [["He dormido en la biblioteca.", "He dormit a la biblioteca."], ["He aprobado sin abrir los apuntes.", "He aprovat sense obrir els apunts."], ["Nunca he dicho «el lunes empiezo».", "Mai he dit «el dilluns comence»."]],
      idle: ["Ronda de ejemplo · tu respuesta no se publica.", "Ronda d’exemple · la teua resposta no es publica."],
      results: [["Pues esta era verdad. La trola era lo del lunes.", "Doncs esta era veritat. La mentida era això del dilluns."], ["Pues esta era verdad. La trola era lo del lunes.", "Doncs esta era veritat. La mentida era això del dilluns."], ["Pillada. Lo del lunes nos lo sabemos todos.", "Pillada. Això del dilluns ens ho sabem tots."]],
      cta: ["Ahora, con gente del campus", "Ara, amb gent del campus"] },
  },
  crush: {
    headline: ["Igual no es nada.", "Potser no és res."], highlight: ["Igual es mutuo.", "Potser és mutu."],
    body: ["Elige en privado si te apetece un café, una cita o algo más. Solo se sabe si las dos personas eligen lo mismo.", "Tria en privat si t’abellix un café, una cita o alguna cosa més. Només se sap si les dues persones trien el mateix."],
    note: ["sin presión, sin exponerte", "sense pressió, sense exposar-te"],
    card: { label: ["UNA ELECCIÓN PARA CALENTAR", "UNA ELECCIÓ PER A ESCALFAR"], title: ["Con alguien de tu clase…", "Amb algú de la teua classe…"], prompt: ["¿Qué te apetecería? Nadie ve tu respuesta.", "Què t’abelliria? Ningú veu la teua resposta."],
      options: [["Un café", "Un café"], ["Una cita", "Una cita"], ["Me lío", "M’embolique"]],
      idle: ["Ronda de ejemplo · aquí no hay nadie al otro lado.", "Ronda d’exemple · ací no hi ha ningú a l’altre costat."],
      results: [["Guardado en secreto. Solo saldría a la luz si la otra persona también elige café.", "Guardat en secret. Només eixiria a la llum si l’altra persona també tria café."], ["Guardado en secreto. Solo saldría a la luz si la otra persona también elige cita.", "Guardat en secret. Només eixiria a la llum si l’altra persona també tria cita."], ["Guardado en secreto. Solo saldría a la luz si la otra persona elige lo mismo.", "Guardat en secret. Només eixiria a la llum si l’altra persona tria el mateix."]],
      cta: ["Probar con gente real", "Provar amb gent real"] },
  },
  questions: {
    headline: ["Pregunta lo que", "Pregunta el que"], highlight: ["nunca preguntarías.", "mai preguntaries."],
    body: ["Un buzón anónimo para cada persona. Quien recibe la pregunta decide qué responde y qué publica.", "Una bústia anònima per a cada persona. Qui rep la pregunta decidix què respon i què publica."],
    note: ["nadie sabrá que fuiste tú", "ningú sabrà que vas ser tu"],
    card: { label: ["UNA PREGUNTA PARA CALENTAR", "UNA PREGUNTA PER A ESCALFAR"], title: ["Sin dar la cara.", "Sense donar la cara."], prompt: ["¿Cuál mandarías a la persona que se sienta a tu lado?", "Quina enviaries a la persona que seu al teu costat?"],
      options: [["¿Por qué siempre te sientas al fondo?", "Per què sempre seus al fons?"], ["¿Qué es lo que más te ha costado este curso?", "Què és el que més t’ha costat este curs?"], ["¿Con quién de clase te irías de viaje?", "Amb qui de classe te n’aniries de viatge?"]],
      idle: ["Ronda de ejemplo · no se envía a nadie.", "Ronda d’exemple · no s’envia a ningú."],
      results: [["Enviada, en el ejemplo. En el juego solo se publica si te responden.", "Enviada, en l’exemple. En el joc només es publica si et responen."], ["Enviada, en el ejemplo. En el juego solo se publica si te responden.", "Enviada, en l’exemple. En el joc només es publica si et responen."], ["Atrevida. En el juego solo se publica si te responden.", "Atrevida. En el joc només es publica si et responen."]],
      cta: ["Abrir mi buzón", "Obrir la meua bústia"] },
  },
  debate: {
    headline: ["Defiende lo que", "Defén el que"], highlight: ["no te crees.", "no et creus."],
    body: ["Dos posturas absurdas, tres turnos por persona y un jurado. Ganar importa menos que la cara dura.", "Dues postures absurdes, tres torns per persona i un jurat. Guanyar importa menys que la cara dura."],
    note: ["que gane quien menos razón tenga", "que guanye qui menys raó tinga"],
    card: { label: ["UNA POSTURA PARA CALENTAR", "UNA POSTURA PER A ESCALFAR"], title: ["La pizza con piña es la mejor pizza.", "La pizza amb pinya és la millor pizza."], prompt: ["¿De qué lado te pones? Luego tocaría convencer.", "De quin costat et poses? Després tocaria convéncer."],
      options: [["La defiendo", "La defenc"], ["La ataco", "L’ataque"]],
      idle: ["Ronda de ejemplo · aquí no hay jurado.", "Ronda d’exemple · ací no hi ha jurat."],
      results: [["Valiente. En el juego tendrías tres turnos para convencer al jurado.", "Valent. En el joc tindries tres torns per a convéncer el jurat."], ["Lo fácil. En el juego tendrías tres turnos para convencer al jurado.", "El fàcil. En el joc tindries tres torns per a convéncer el jurat."]],
      cta: ["Buscar rival en el campus", "Buscar rival al campus"] },
  },
  hangout: {
    headline: ["Tienes un hueco.", "Tens un buit."], highlight: ["Alguien también.", "Algú també."],
    body: ["Un rato libre entre clases y gente que se apunta. Sin planes de meses ni grupos eternos.", "Una estona lliure entre classes i gent que s’apunta. Sense plans de mesos ni grups eterns."],
    note: ["un café de quince minutos cuenta", "un café de quinze minuts compta"],
    card: { label: ["UN HUECO PARA CALENTAR", "UN BUIT PER A ESCALFAR"], title: ["Hoy a las 17:00, cafetería de Tarongers.", "Hui a les 17:00, cafeteria de Tarongers."], prompt: ["¿Cuánto tiempo tienes?", "Quant de temps tens?"],
      options: [["Quince minutos", "Quinze minuts"], ["Cuarenta minutos", "Quaranta minuts"], ["Toda la tarde", "Tota la vesprada"]],
      idle: ["Ronda de ejemplo · el encuentro no existe.", "Ronda d’exemple · la trobada no existix."],
      results: [["Justo para un café. En el juego, reservar una plaza abre un chat con quien se apunta.", "Just per a un café. En el joc, reservar una plaça obri un xat amb qui s’apunta."], ["Da para una conversación. En el juego, reservar una plaza abre un chat con quien se apunta.", "Dona per a una conversa. En el joc, reservar una plaça obri un xat amb qui s’apunta."], ["Entonces propón tú el encuentro. En el juego, tú eliges duración y plazas.", "Llavors proposa tu la trobada. En el joc, tu tries durada i places."]],
      cta: ["Ver quién tiene hueco", "Vore qui té un buit"] },
  },
  jury: {
    headline: ["Vota primero.", "Vota primer."], highlight: ["Discute después.", "Discutix després."],
    body: ["Un dilema del campus, dos posturas y el veredicto de todo el mundo. Los resultados se ven al votar.", "Un dilema del campus, dues postures i el veredicte de tot el món. Els resultats es veuen en votar."],
    note: ["el campus tiene opinión", "el campus té opinió"],
    card: { label: ["UN DILEMA PARA CALENTAR", "UN DILEMA PER A ESCALFAR"], title: ["Salir de un grupo de clase sin avisar.", "Eixir d’un grup de classe sense avisar."], prompt: ["¿Se puede o no se puede?", "Es pot o no es pot?"],
      options: [["A favor", "A favor"], ["En contra", "En contra"]],
      idle: ["Ronda de ejemplo · tu voto no cuenta.", "Ronda d’exemple · el teu vot no compta."],
      results: [["Voto de ejemplo guardado. En el juego verías el resultado del campus y después se debate.", "Vot d’exemple guardat. En el joc vories el resultat del campus i després es debat."], ["Voto de ejemplo guardado. En el juego verías el resultado del campus y después se debate.", "Vot d’exemple guardat. En el joc vories el resultat del campus i després es debat."]],
      cta: ["Votar el dilema de esta semana", "Votar el dilema d’esta setmana"] },
  },
  blind: {
    headline: ["Primero hablar.", "Primer parlar."], highlight: ["Luego, la cara.", "Després, la cara."],
    body: ["Los jueves empieza la ronda. Después tenéis 48 horas de conversación escrita antes de saber quién hay al otro lado.", "Els dijous comença la ronda. Després teniu 48 hores de conversa escrita abans de saber qui hi ha a l’altre costat."],
    note: ["los jueves son para esto", "els dijous són per a això"],
      card: { label: ["UNA FRASE PARA CALENTAR", "UNA FRASE PER A ESCALFAR"], title: ["48 horas. Sin fotos.", "48 hores. Sense fotos."], prompt: ["¿Con qué frase empezarías?", "Amb quina frase començaries?"],
      options: [["¿Qué serie te ha decepcionado más?", "Quina sèrie t’ha decebut més?"], ["Confiesa: ¿biblioteca o cafetería?", "Confessa: biblioteca o cafeteria?"], ["¿El mejor sitio para perder una tarde?", "El millor lloc per a perdre una vesprada?"]],
      idle: ["Ronda de ejemplo · nadie está leyendo.", "Ronda d’exemple · ningú està llegint."],
      results: [["Buen arranque. El jueves empieza la ronda y tenéis 48 horas para hablar.", "Bon començament. El dijous comença la ronda i teniu 48 hores per a parlar."], ["Directa al grano. El jueves empieza la ronda y tenéis 48 horas para hablar.", "Directa al gra. El dijous comença la ronda i teniu 48 hores per a parlar."], ["Buen arranque. El jueves empieza la ronda y tenéis 48 horas para hablar.", "Bon començament. El dijous comença la ronda i teniu 48 hores per a parlar."]],
      cta: ["Así funciona la cita", "Així funciona la cita"] },
  },
};

// El día en València ("AAAA-MM-DD"): lo comparten el juego del día, la ronda de
// calentamiento guardada y el calendario de la cita.
const madridFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
export function madridDay(now: Date = new Date()): string { return madridFormat.format(now); }

// El mismo juego en Inicio y en Explorar durante todo el día: la tarjeta de Inicio
// promete exactamente el banner que abrirá Explorar. Cambia a medianoche, hora de
// València, y el cálculo es el mismo en el servidor y en el navegador.
export function openingOfDay(ids: readonly GameKind[], now: Date = new Date()): GameKind {
  if (!ids.length) return "truth";
  const day = Math.floor(Date.parse(`${madridDay(now)}T00:00:00Z`) / 86_400_000);
  return ids[((day % ids.length) + ids.length) % ids.length];
}
