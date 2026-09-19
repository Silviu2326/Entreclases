import type { CommunityData, Group, GroupMember, Like, Plan, PlanMember, Post, Profile } from "./types";
import type { Locale } from "../i18n/routes";

/**
 * Fixtures visuales para revisar Inicio sin tocar Supabase.
 * Se activan únicamente con /app/?fake=1 y se pueden retirar eliminando este archivo
 * y su import en community-app.tsx.
 */
export function withFakeHomeData(data: CommunityData, locale: Locale): CommunityData {
  const text = (es: string, va: string) => locale === "va" ? va : es;
  const now = Date.now();
  const ago = (hours: number) => new Date(now - hours * 60 * 60 * 1000).toISOString();
  const later = (hours: number) => new Date(now + hours * 60 * 60 * 1000).toISOString();
  const viewerId = data.profiles[0]?.user_id ?? "fake-viewer";

  const profiles: Profile[] = [
    { user_id: "fake-paula", name: "Paula Martí", university: "Universitat de València", campus: "Tarongers", degree: text("Diseño industrial", "Disseny industrial"), year: 2, bio: text("Colecciono ideas en servilletas. Busco gente para hacerlas realidad.", "Col·leccione idees en tovallons. Busque gent per a fer-les realitat."), interests: ["Arte", "Proyectos", "Café"], color: 1, avatar_url: "/avatars/paula.svg", relationship_status: "seeing_someone", created_at: ago(4) },
    { user_id: "fake-marc", name: "Marc Ferrer", university: "Universitat de València", campus: "Tarongers", degree: text("Derecho", "Dret"), year: 3, bio: text("Una pachanga, una horchata y ya hemos arreglado la tarde.", "Una patxanga, una orxata i ja hem arreglat la vesprada."), interests: ["Deporte", "Naturaleza"], color: 2, avatar_url: "/avatars/marc.svg", relationship_status: "in_relationship", created_at: ago(7) },
    { user_id: "fake-laia", name: "Laia Soler", university: "Universitat de València", campus: "Blasco Ibáñez", degree: text("Psicología", "Psicologia"), year: 2, bio: text("Cine de martes. Playa de viernes. Apuntes el resto.", "Cine de dimarts. Platja de divendres. Apunts la resta."), interests: ["Cine", "Música", "Naturaleza"], color: 3, avatar_url: "/avatars/laia.svg", relationship_status: "single", created_at: ago(10) },
    { user_id: "fake-nico", name: "Nico Vidal", university: "Universitat Politècnica de València", campus: "Vera", degree: text("Ingeniería informática", "Enginyeria informàtica"), year: 2, bio: text("Programo cosas. Algunas hasta funcionan. ¿Montamos algo?", "Programe coses. Algunes fins i tot funcionen. Muntem alguna cosa?"), interests: ["Tecnología", "Proyectos", "Café"], color: 4, avatar_url: "/avatars/nico.svg", relationship_status: "prefer_not_to_say", created_at: ago(14) },
    { user_id: "fake-aina", name: "Aina Costa", university: "Universitat de València", campus: "Burjassot-Paterna", degree: text("Biología", "Biologia"), year: 3, bio: text("La mejor pantalla es un atardecer en l’Albufera.", "La millor pantalla és una posta de sol a l’Albufera."), interests: ["Naturaleza", "Arte"], color: 5, avatar_url: "/avatars/aina.svg", relationship_status: "single", created_at: ago(18) },
  ];

  const plans: Plan[] = [
    { id: "fake-plan-coffee", creator_id: "fake-paula", title: text("Un café. Cero excusas.", "Un café. Cap excusa."), description: text("Nos conocemos, hablamos de todo menos de entregas y elegimos sitio para tomar café por el barrio.", "Ens coneixem, parlem de tot menys d’entregues i triem lloc per a prendre café pel barri."), place: "Benimaclet", meeting_point: text("En la plaza de Benimaclet, junto a la fuente.", "A la plaça de Benimaclet, al costat de la font."), starts_at: later(25), capacity: 8, created_at: ago(2) },
    { id: "fake-plan-turia", creator_id: "fake-marc", title: text("Paseo por el Turia y lo que surja", "Passeig pel Túria i el que vinga"), description: text("Calzado cómodo. Ritmo de conversación. Bajamos al jardín desde las Torres.", "Calçat còmode. Ritme de conversa. Baixem al jardí des de les Torres."), place: "Torres de Serranos", meeting_point: text("Delante de las Torres, en la plaza dels Furs.", "Davant de les Torres, a la plaça dels Furs."), starts_at: later(49), capacity: 10, created_at: ago(5) },
    { id: "fake-plan-beach", creator_id: "fake-laia", title: text("La última luz en la Malvarrosa", "L’última llum a la Malva-rosa"), description: text("Manta, algo de picar y ganas de hablar. Cada cual trae lo suyo.", "Manta, alguna cosa per a picar i ganes de parlar. Cadascú porta el que vulga."), place: "La Malvarrosa", meeting_point: text("Paseo marítimo, frente a la Casa Museo Blasco Ibáñez.", "Passeig marítim, davant de la Casa Museu Blasco Ibáñez."), starts_at: later(73), capacity: 12, created_at: ago(8) },
    { id: "fake-plan-albufera", creator_id: "fake-aina", title: text("L’Albufera no tiene filtro", "L’Albufera no té filtre"), description: text("Quedamos para ver la puesta de sol y organizamos el transporte entre quienes se apunten.", "Quedem per a vore la posta de sol i organitzem el transport entre qui s’apunte."), place: "L’Albufera · Gola de Pujol", meeting_point: text("En el mirador de la Gola de Pujol.", "Al mirador de la Gola de Pujol."), starts_at: later(97), capacity: 6, created_at: ago(12) },
    { id: "fake-plan-project", creator_id: "fake-nico", title: text("Ideas en una servilleta", "Idees en un tovalló"), description: text("Una hora para contar ese proyecto que lleva meses en tu cabeza.", "Una hora per a contar eixe projecte que fa mesos que tens al cap."), place: "Campus de Vera · Ágora", meeting_point: text("Bajo el reloj del Ágora.", "Davall del rellotge de l’Àgora."), starts_at: later(121), capacity: 6, created_at: ago(15) },
  ];

  const posts: Post[] = [
    { id: "fake-post-paula", author_id: "fake-paula", body: text("El grupo de WhatsApp lleva tres semanas diciendo «a ver si quedamos». He reservado la tarde. Café en Benimaclet, cuadernos fuera y móviles boca abajo. ☕", "El grup de WhatsApp fa tres setmanes que diu «a vore si quedem». M’he guardat la vesprada. Café a Benimaclet, llibretes fora i mòbils cap per avall. ☕"), kind: "post", group_id: null, created_at: ago(1) },
    { id: "fake-post-laia", author_id: "fake-laia", body: text("Pregunta seria: ¿alguien más entiende mejor el tema 4 cuando se lo explica otra persona? Busco compi de estudio en Blasco esta semana.", "Pregunta seriosa: algú més entén millor el tema 4 quan li l’explica una altra persona? Busque companyia per a estudiar a Blasco esta setmana."), kind: "question", group_id: "fake-group-study", created_at: ago(3) },
    { id: "fake-post-marc", author_id: "fake-marc", body: text("Salimos de clase para ir a casa. Acabamos cruzando el campus sin mirar la hora. Esto también debería dar créditos.", "Eixim de classe per a anar a casa. Acabem travessant el campus sense mirar l’hora. Açò també hauria de donar crèdits."), kind: "post", group_id: null, image_url: "/images/campus-feed.webp", created_at: ago(5) },
    { id: "fake-post-nico", author_id: "fake-nico", body: text("Tengo una idea a medias y un café entero. ¿Alguien de diseño para montar un proyecto pequeño en Vera? Cero discursos de emprendedor. Prometido.", "Tinc una idea a mitges i un café sencer. Algú de disseny per a muntar un projecte menut a Vera? Cap discurs d’emprenedor. Promés."), kind: "question", group_id: "fake-group-build", created_at: ago(8) },
  ];

  const groups: Group[] = [
    { id: "fake-group-study", creator_id: "fake-laia", name: text("Los del tema 4", "Els del tema 4"), description: text("Apuntes, dudas y compañía para estudiar. Nadie nace sabiendo estadística.", "Apunts, dubtes i companyia per a estudiar. Ningú naix sabent estadística."), category: "study", campus: "Blasco Ibáñez", created_at: ago(40) },
    { id: "fake-group-outside", creator_id: "fake-marc", name: text("Nos vemos fuera", "Ens veiem fora"), description: text("El Turia, la playa o donde caiga. Hay vida después de las prácticas.", "El Túria, la platja o on siga. Hi ha vida després de les pràctiques."), category: "leisure", campus: "Tarongers", created_at: ago(42) },
    { id: "fake-group-build", creator_id: "fake-nico", name: text("Gente que hace cosas", "Gent que fa coses"), description: text("Una idea, distintas carreras y ganas de probar. Empezamos en Vera.", "Una idea, carreres diferents i ganes de provar. Comencem a Vera."), category: "projects", campus: "Vera", created_at: ago(45) },
  ];

  const groupMembers: GroupMember[] = [
    { group_id: "fake-group-study", user_id: "fake-laia" }, { group_id: "fake-group-study", user_id: viewerId },
    { group_id: "fake-group-outside", user_id: "fake-marc" }, { group_id: "fake-group-outside", user_id: "fake-aina" },
    { group_id: "fake-group-build", user_id: "fake-nico" }, { group_id: "fake-group-build", user_id: "fake-paula" },
  ];
  const planMembers: PlanMember[] = [
    { plan_id: "fake-plan-coffee", user_id: "fake-paula" }, { plan_id: "fake-plan-coffee", user_id: "fake-marc" },
    { plan_id: "fake-plan-turia", user_id: "fake-marc" }, { plan_id: "fake-plan-turia", user_id: viewerId },
    { plan_id: "fake-plan-beach", user_id: "fake-laia" }, { plan_id: "fake-plan-albufera", user_id: "fake-aina" },
    { plan_id: "fake-plan-project", user_id: "fake-nico" },
  ];
  const likes: Like[] = [{ post_id: "fake-post-paula", user_id: "fake-laia" }, { post_id: "fake-post-paula", user_id: "fake-marc" }, { post_id: "fake-post-marc", user_id: viewerId }];

  const viewerProfiles = data.profiles.map((profile, index) => (
    index === 0 && !profile.avatar_url
      ? { ...profile, avatar_url: "/avatars/alex.svg" }
      : profile
  ));

  return {
    ...data,
    profiles: [...viewerProfiles, ...profiles.filter(profile => !viewerProfiles.some(existing => existing.user_id === profile.user_id))],
    plans: [...plans, ...data.plans],
    planMembers: [...planMembers, ...data.planMembers],
    posts: [...posts, ...data.posts],
    comments: [{ id: "fake-comment-1", post_id: "fake-post-paula", author_id: "fake-marc", body: text("Móviles boca abajo. Esa es la parte difícil 😂", "Mòbils cap per avall. Eixa és la part difícil 😂"), created_at: ago(.5) }, ...data.comments],
    likes: [...likes, ...data.likes],
    groups: [...groups, ...data.groups],
    groupMembers: [...groupMembers, ...data.groupMembers],
  };
}
