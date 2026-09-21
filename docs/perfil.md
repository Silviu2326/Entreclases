# El perfil

El perfil es una presentación viva, no una ficha. Se rellena a toques: la única
caja de texto es la biografía, dentro de **Editar mi perfil**.

La página va en una columna: portada, **La estantería**, **Sin pensarlo**,
**Logros** y las publicaciones. La ficha de otra persona (en Gente) enseña lo
mismo en pequeño, precedido de **lo que tenéis en común**.

## Editar el perfil

El botón **Editar mi perfil** abre un asistente a pantalla grande, por pasos, con
las categorías a la izquierda: *Quién eres*, *Tu cara*, *Dónde andas*, *Tu bio* y
*Lo que te mueve*. Una pregunta grande por pantalla, Intro para seguir, y se
puede saltar a cualquier categoría desde la barra lateral. Lo escrito se guarda
al final, de una vez, con **Guardar y salir**.

La estantería y las elecciones rápidas **no** están en el asistente: se editan
donde se ven, en la propia página.

### Foto y portada

En *Tu cara* se sube la foto de perfil y la portada, y se ve el resultado antes
de guardar. Las imágenes se recortan y se encogen **en el navegador** antes de
salir del dispositivo (`lib/community/images.ts`): la foto queda en 320×320 y la
portada en 1280×420, siempre webp y por debajo de 1 MB. Se guardan al momento,
sin esperar al final del asistente.

Los archivos viven en el bucket privado `universe-faces`, una carpeta por
persona. Al leer, `lib/community/repository.ts` pide **enlaces firmados** de una
sola vez para todos los perfiles cargados (una hora de validez), así que una
cara solo la ve quien ha entrado con correo universitario: nunca queda expuesta
en internet. Al cambiar una imagen se borra la anterior.

En la demo no se sube nada: la imagen se queda en la pestaña como enlace local y
desaparece al recargar.

Si la migración `202609200014_profile_faces.sql` no está aplicada, el asistente
lo dice con una línea y el resto del perfil se sigue editando con normalidad.

## La estantería

Cuatro baldas —series, pelis, juegos y música— de hasta cinco cosas cada una.
La casilla punteada abre el buscador; tocar una carátula ya puesta la marca como
**ahora** (lo que tienes entre manos), una por balda. Debajo de cada carátula, un
`+N` discreto dice cuánta gente del campus comparte eso.

Lo elegido se guarda **ya resuelto**: título, subtítulo y la ruta de la carátula.
Ver un perfil no llama a ninguna API, así que carga al instante y sigue
funcionando si un catálogo cambia o desaparece.

| Balda | De dónde salen los resultados | Clave |
| --- | --- | --- |
| Series y pelis | TMDB | `NEXT_PUBLIC_TMDB_KEY` |
| Juegos | RAWG | `NEXT_PUBLIC_RAWG_KEY` |
| Música | iTunes Search | ninguna |

Las claves son **públicas de solo lectura**: viajan al navegador porque la
aplicación se exporta estática y no hay servidor donde esconderlas. Nunca pongas
ahí un secreto. Sin claves, el buscador usa una lista corta incluida en
`lib/community/tastes.ts` y lo avisa con una línea; nada se rompe.

Solo se guarda la *ruta* de la imagen. La dirección completa se reconstruye al
pintar, a partir de las bases fijas de `lib/community/tastes.ts`, y esos tres
dominios son los únicos permitidos en `next.config.ts`. Así un perfil no puede
acabar apuntando al servidor de imágenes de un tercero.

## Sin pensarlo

Doce elecciones de dos opciones, un toque cada una. Es identidad, no debate: no
se vota ni se comenta, para no pisar el juego «El jurado del campus».

Para añadir o cambiar una elección, edita `lib/community/picks.ts`: cada entrada
lleva su título y sus dos opciones en castellano y valenciano, con emoji y
`slug`. **Lo que se guarda es el `slug`**, así que si añades opciones nuevas hay
que sumarlas también a la lista del `check` de la columna `picks` con una
migración nueva; si no, la base de datos rechazará el guardado.

## Dónde vive cada cosa

| Qué | Dónde |
| --- | --- |
| Buscador, catálogo de reserva y validación de gustos | `lib/community/tastes.ts` |
| Catálogo de elecciones rápidas | `lib/community/picks.ts` |
| Estantería, selector, elecciones y «en común» | `components/community/profile-tastes.tsx` |
| Página de perfil y ficha de otra persona | `components/community/people-profile.tsx` |
| Textos (castellano y valenciano) | `lib/community/copy.ts` |
| Estilos | `app/community.css` (`u-wiz*`, `u-shelf*`, `u-taste*`, `u-picker*`, `u-pick*`, `u-common*`) |
| Columnas `favorites` y `picks` | `supabase/migrations/202609200013_profile_tastes.sql` |
| Asistente de edición | `components/community/profile-editor.tsx` |
| Recorte y encogido de imágenes | `lib/community/images.ts` |
| Columnas `avatar_url`/`banner_url` y bucket de caras | `supabase/migrations/202609200014_profile_faces.sql` |

## La base de datos

La migración añade dos columnas a `universe_profiles`: `favorites` (jsonb) y
`picks` (text[]), con su `grant update(...)`, que es obligatorio: sin él el
guardado falla aunque la RLS lo permita.

Mientras la migración **no** esté aplicada, `lib/community/repository.ts` lo
detecta al leer y quita esos dos campos antes de guardar, así que el resto del
perfil se sigue guardando con normalidad y estos bloques simplemente no
persisten. Al aplicarla empiezan a guardarse solos, sin tocar código.

## Probarlo sin cuentas reales

`http://127.0.0.1:3000/demo/?view=profile`. Las seis personas de ejemplo de
`lib/community/demo.ts` ya traen estantería y elecciones, con coincidencias
entre ellas, para que «lo que tenéis en común» tenga algo que enseñar. Los
cambios de la demo duran lo que dure la visita.
