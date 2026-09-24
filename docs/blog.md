# Blog

`/blog/` y `/va/blog/` son, con la portada y el roadmap, las únicas páginas indexables. Existen para que alguien que busca «cómo hacer amigos en la universidad» o «planes para estudiantes en Valencia» llegue a Entreclases sin conocer la marca. Cada entrada termina con el mismo formulario de la lista de correo, registrado con origen `blog` (migración `202609260028`; hasta aplicarla, el navegador reintenta con `landing` para no perder la dirección).

## Cómo se publica una entrada

1. Crea `content/blog/<id>.ts` exportando un `Post` (mira cualquiera de los existentes). Cada entrada lleva las dos lenguas: `es` y `va`, con slug, título, descripción, keyword objetivo y cuerpo.
2. Impórtala en `lib/blog/posts.ts` y añádela a la lista `posts`. Se ordena sola por fecha.
3. `npm run test:auth` comprueba slugs únicos, longitud de título y descripción, enlaces internos en la misma lengua, metadatos, datos estructurados y sitemap.
4. `npm run build` genera las páginas y `sitemap.xml` con las alternancias de idioma. Después del despliegue, envía el sitemap en Search Console si no está ya.

El cuerpo se escribe en un subconjunto de Markdown: párrafos, `##` y `###`, listas con `-` o `1.`, citas con `>` y, en línea, `**negrita**`, `*cursiva*` y `[enlace](/ruta/)`. Nada de HTML: el texto se convierte en elementos React y se escapa siempre. Los enlaces internos deben quedarse en la misma lengua (`/va/...` desde el texto valenciano).

Reglas de contenido, heredadas de `entre-lineas-voz-editorial.md`: abrir con una escena, no inventar cifras ni horarios (enlazar a la fuente oficial cuando cambian), nada de «experiencias únicas», humor que no humilla, cerrar con un paso pequeño. Título de 40 a 70 caracteres con la keyword al principio; descripción de 120 a 160 caracteres que responda a la búsqueda; una imagen de `public/images/` con texto alternativo en las dos lenguas.

## Qué hace la sección por el SEO

- Título, descripción, canónica y `hreflang` es / ca-ES / x-default por entrada, en `lib/blog/metadata.ts`.
- `BlogPosting` y `BreadcrumbList` en cada entrada, `Blog` en el índice (`components/entreclase/json-ld.tsx`).
- `app/sitemap.ts` sustituye al XML estático: portada, roadmap, índice del blog y cada entrada en las dos lenguas con `lastmod` y alternancias. Las rutas privadas siguen fuera y con `noindex`.
- Índice de secciones a partir de los `##`, enlaces cruzados entre entradas, «Más del blog» al final y enlace al roadmap.
- La portada no enlaza al blog a propósito mientras dure la prelanding. Google lo descubre por el sitemap; cuando vuelva la landing completa, conviene un enlace en el pie.

## Plan de keywords

Sin volúmenes exactos: valídalos en Google Keyword Planner y, a las seis semanas, en Search Console (consultas por página). Quien posiciona hoy: blogs de residencias para «hacer amigos en la universidad», webs de alojamiento y Visit Valencia para «planes estudiantes Valencia», Wuolah / Studocu / Docsity para «apuntes UV / UPV». Ninguno tiene ángulo local y de comunidad.

| Prioridad | Keyword principal | Variantes | Cuándo | Estado |
|---|---|---|---|---|
| 1 | cómo hacer amigos en la universidad | conocer gente en la uni, llegar nuevo a Valencia, primer día de universidad | sept-oct | Publicada |
| 1 | planes para estudiantes en Valencia | planes baratos Valencia, qué hacer gratis en Valencia estudiante | sept | Publicada |
| 1 | Erasmus Valencia conocer gente | grupos Erasmus Valencia, vida Erasmus Valencia | sept y enero | Publicada |
| 2 | sitios para estudiar en Valencia | bibliotecas 24 horas Valencia exámenes, cafeterías para estudiar Valencia | nov-ene y mayo | Publicada |
| 2 | grupo de estudio universidad | cómo montar un grupo de estudio, estudiar en grupo exámenes | nov-dic | Pendiente |
| 2 | qué hacer en Benimaclet | bares Benimaclet estudiantes, vivir en Benimaclet, mejores barrios para estudiantes en Valencia | continuo | Pendiente |
| 2 | Fallas para estudiantes | guía Fallas universitario, Fallas con amigos nuevos | feb-mar | Pendiente |
| 2 | paellas universitarias Valencia | fecha, entradas, qué llevar | mar-abr | Pendiente |
| 3 | campus de Tarongers / Burjassot / Vera | qué hay en el campus, dónde comer, cómo llegar | continuo | Pendiente |
| 3 | universidades de Valencia | públicas y privadas, UV vs UPV, asociaciones estudiantiles, clubes UPV | continuo | Pendiente |
| 3 | descuentos estudiantes Valencia | SUMA jove, carnet universitario descuentos, comer barato universidad | sept y enero | Pendiente |
| 3 | apps para estudiantes universitarios | app para conocer gente en la universidad, red social universitaria | continuo | Pendiente |
| 4 | valenciano: com fer amics a la universitat, plans a València per a estudiants | | continuo | Publicadas con cada entrada |

Descartadas: «piso estudiantes Valencia» (Idealista, Erasmus Play, Uniplaces) y «apuntes de [asignatura]» (Wuolah, Studocu). No es el producto y no se gana.

## Calendario sugerido

Una entrada por semana en español, con su versión valenciana el mismo día.

- Octubre: grupo de estudio; qué hacer en Benimaclet; universidades de Valencia (públicas, privadas y a quién admite Entreclases); descuentos y transporte para estudiantes.
- Noviembre: cafeterías para estudiar por campus; cómo pedir apuntes sin dar corte; asociaciones y clubes de la UV y la UPV.
- Diciembre y enero: guía de exámenes de enero (actualizar la entrada de bibliotecas con las fechas del periodo); Erasmus de febrero.
- Febrero y marzo: Fallas para estudiantes; segundo cuatrimestre, segunda oportunidad para conocer gente.
- Abril y mayo: paellas universitarias; planes de primavera; exámenes de junio.

Reutiliza los guiones de `output/` (TikTok e Instagram): cada uno es el borrador de una entrada.
