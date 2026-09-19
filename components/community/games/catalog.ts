import dynamic from "next/dynamic";

// Disable a single experience here. Its implementation is kept in its own file.
export const games = [
  { id: "crush", enabled: true, title: ["¿Me lío?", "Ens emboliquem?"], description: ["Un café, una cita o esa chispa. Solo si es mutuo.", "Un café, una cita o eixa espurna. Només si és mutu."], component: dynamic(() => import("./me-lio")) },
  { id: "questions", enabled: true, title: ["Sin dar la cara", "Sense donar la cara"], description: ["Preguntas anónimas. Tú eliges qué responder.", "Preguntes anònimes. Tu tries què respondre."], component: dynamic(() => import("./preguntas-anonimas")) },
  { id: "debate", enabled: true, title: ["Defiende lo indefendible", "Defén l'indefensable"], description: ["Dos posturas absurdas. Tres turnos para convencer.", "Dues postures absurdes. Tres torns per a convéncer."], component: dynamic(() => import("./defiende-lo-indefendible")) },
  { id: "truth", enabled: true, title: ["Dos verdades y una trola", "Dues veritats i una mentida"], description: ["Adivina cuál es. Descubre quién hay detrás.", "Endevina quina és. Descobrix qui hi ha darrere."], component: dynamic(() => import("./dos-verdades")) },
  { id: "hangout", enabled: true, title: ["Hay hueco", "Hi ha lloc"], description: ["Un rato libre y alguien con quien compartirlo.", "Una estona lliure i algú amb qui compartir-la."], component: dynamic(() => import("./hay-hueco")) },
  { id: "jury", enabled: true, title: ["El jurado del campus", "El jurat del campus"], description: ["Vota primero. Luego defiende tu veredicto.", "Vota primer. Després defensa el teu veredicte."], component: dynamic(() => import("./jurado-del-campus")) },
  { id: "blind", enabled: true, title: ["La cita empieza hablando", "La cita comença parlant"], description: ["Jueves, 19:30–21:00. Primero la conversación.", "Dijous, 19:30–21:00. Primer la conversa."], component: dynamic(() => import("./cita-a-ciegas")) },
] as const;
