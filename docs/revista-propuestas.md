# Propuestas para Entre líneas

## Qué puede hacer el autor

## Páginas de la revista

Revista ya no se presenta como un documento único. Cada parte tiene una URL propia y conserva el estado al usar atrás o adelante del navegador:

- `?view=magazine` — Portada y sumario de la edición elegida.
- `?view=magazine&page=read#revista-lectura` — Lectura de las historias, con búsqueda y tamaño de letra.
- `?view=magazine&page=proposals#revista-mis-propuestas` — Propuestas del usuario, editor, respuestas e historial.
- `?view=magazine&page=archive#revista-archivo` — Hemeroteca y cambio de edición.

Los enlaces del sumario abren directamente la página de lectura y enfocan la historia seleccionada.

- Escribir una historia propia o vincular su proyecto, plan o hilo público. Las iniciativas externas llevan una fuente.
- Elegir sección, titular, entradilla, texto de hasta 8.000 caracteres y presentación: texto primero, foto de apertura o foto junto al texto.
- Añadir hasta cuatro imágenes JPG, PNG o WebP (6 MB de entrada por archivo), ordenarlas, eliminarlas y escribir descripción accesible, pie y crédito. Se convierten a WebP, sin los metadatos del archivo original, a un máximo de 1.600 píxeles.
- Guardar borradores privados, ver una vista previa y enviar una versión autorizada.
- Consultar sus propuestas, filtrar por estado, leer respuestas editoriales y revisar el historial de estados.
- Retirar el permiso, corregir y volver a enviar. Los cambios necesitan una nueva autorización.

## Recorrido editorial

Borrador → En revisión → Aceptada / Cambios solicitados / Rechazada.

Aceptar no publica: un editor asigna la pieza aceptada a una edición y publica esa edición. Entonces la propuesta pasa a Publicada. La retirada elimina la pieza de la edición y del archivo. El autor conserva su propuesta para corregirla y volver a enviarla.

Rechazar o pedir cambios exige una explicación. La selección conserva el texto, imágenes, orden, créditos y presentación autorizados. Las notas privadas y el historial no forman parte del artículo público. La revisión de una propuesta no permite editar su contenido.

## Activación en Supabase

Aplicar `supabase/migrations/202609200011_magazine_proposals.sql` después de la migración de proyectos y revista `202609190008_projects_magazine.sql`. No repetir una migración ya aplicada. La nueva migración crea las columnas, el flujo de revisión, las políticas y el contenedor privado de imágenes `universe-magazine`.

El código espera `magazine_version: 2` en la respuesta de `universe_studio`. Hasta aplicar la migración, el editor muestra un aviso de vista previa y deshabilita guardar y enviar. Esta implementación no ha aplicado la migración al servicio remoto: se necesita acceso administrativo a ese proyecto de Supabase.

Los editores se gestionan mediante el mecanismo existente de `universe_magazine_editors`; un usuario normal no puede revisar ni publicar. Los borradores solo los ve su autor. Los miembros verificados acceden únicamente a piezas publicadas y autorizadas. Las imágenes tienen enlaces temporales de cuatro minutos: tras retirar una pieza no se generan nuevos enlaces, aunque uno ya emitido puede seguir funcionando hasta caducar.

## Demo y comprobaciones

`/demo/?view=magazine` contiene propuestas ficticias en varios estados y permite simular la revisión editorial. Los cambios e imágenes de esa demo solo duran la visita y no se envían a Supabase.

Pruebas de permisos y recorrido:

```sh
node --experimental-strip-types --test tests/magazine-proposals.test.mjs tests/projects-magazine.test.mjs
```

Cubren privacidad, roles, versiones concurrentes, propiedad de imágenes, autorización, solicitud de cambios, aceptación, publicación y retirada. La prueba de navegador comprueba subir una imagen, guardarla en un borrador, retomarlo, enviarlo y ver la aceptación y respuesta editorial, además del editor en móvil.
