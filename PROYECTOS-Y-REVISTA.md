# Proyectos y revista de Entreclase

## Qué incorpora esta versión

**Proyectos**, dentro de Explorar y también en `?view=projects`:

- Una ficha con objetivo, material existente, aportación del creador, puestos, dedicación, modalidad y compensación.
- Búsqueda por habilidad, modalidad y etapa; vista de proyectos propios, seguidos y con solicitud.
- Una plaza por puesto, hasta seis puestos con nombres distintos. Principiantes admitidos cuando lo indique el creador.
- Solicitud privada con aportación, disponibilidad y enlace opcional. El creador acepta o rechaza. Solicitar no convierte al usuario en miembro.
- Seguimiento de avances sin incorporarse al equipo.
- Tres hitos, etapa del proyecto y conversación privada del equipo con enlaces. Los mensajes se actualizan al pulsar «Actualizar conversación».
- Resultado final con créditos. Publicarlo cierra nuevas incorporaciones. Cada participante puede añadir o quitar ese resultado de su perfil.

**Revista**, en `?view=magazine`, con acceso desde la navegación y adelantos en Inicio y Explorar:

- Portada editorial, fecha, edición actual y archivo.
- Propuestas de proyectos, planes e hilos públicos propios. Las iniciativas externas requieren una fuente enlazada y un texto escrito por quien lo propone.
- Vista previa del titular, texto y atribución antes de autorizar. No se importan respuestas ajenas, conversaciones privadas ni imágenes.
- Autorización explícita para esta versión y solo dentro de la comunidad verificada. El autor puede retirarla incluso de una edición publicada.
- Selección manual de hasta seis piezas por edición. Autorizar una propuesta no garantiza que se seleccione.
- Mesa editorial accesible únicamente a las personas designadas desde la base de datos. Los editores pueden seleccionar, pero no reescribir un texto autorizado.
- La demo incluye un rol editorial ficticio para probar todo el recorrido. Este rol no se concede a las cuentas reales.

## Ejemplos y datos reales

Los ejemplos están separados en `lib/community/studio/demo.ts`. Viven en memoria durante la visita y nunca se envían a Supabase. Solo se cargan en `/demo/`.

En `/app/` se utiliza el acceso real. Si falta la ampliación de la base de datos, se muestra un aviso con enlace a la demo; no se sustituyen los datos reales por ejemplos.

## Activación en el campus real

La ampliación está preparada pero no se ha ejecutado en el Supabase remoto desde esta tarea.

1. En una instalación que ya tiene las tablas de comunidad, ejecutar una sola vez `supabase/migrations/202609190008_projects_magazine.sql` en el editor SQL de Supabase. No ejecutar de nuevo el instalador completo `setup.sql` sobre una instalación existente.
2. Un administrador debe designar a la persona responsable de la revista. Sustituir el identificador del ejemplo por el de su perfil real:

```sql
insert into public.universe_magazine_editors(user_id)
values ('UUID_DEL_PERFIL_EDITOR')
on conflict do nothing;
```

No se necesitan claves secretas en el navegador. El acceso comprueba la cuenta universitaria verificada, la propiedad del contenido, la pertenencia al equipo y el rol editorial en la base de datos.

## Organización

- `components/community/projects.tsx`: fichas, creación, solicitudes, hitos y resultado.
- `components/community/magazine.tsx`: revista, propuestas, archivo y mesa editorial.
- `components/community/studio-context.tsx`: conexión, estado compartido y resultados en el perfil.
- `components/community/studio.css`: estilos de ambos espacios.
- `lib/community/studio/types.ts`: datos compartidos.
- `lib/community/studio/demo.ts`: ejemplos y acciones de prueba aislados.
- `supabase/migrations/202609190008_projects_magazine.sql`: almacenamiento y permisos.
- `tests/projects-magazine.test.mjs`: pruebas de acceso, solicitudes, equipo, consentimiento, archivo y créditos.

## Límites de esta primera versión

La dedicación se describe en la ficha; aún no es un filtro numérico. No hay métricas de conversión de la revista, publicación programada, notificaciones, generación automática de ediciones, subida de archivos de equipo ni distribución pública, por correo o por redes. Los enlaces de iniciativas se revisan manualmente. Los enlaces de piezas de proyectos abren su ficha; los de planes e hilos llevan a su sección de participación.

La maqueta editorial no incluye fotografías: usa ilustraciones gráficas propias y el texto autorizado. Añadir imágenes requerirá extender la vista previa y guardar también su autorización.

## Comprobaciones realizadas

Compilación de producción y comprobación de TypeScript correctas. Once pruebas automatizadas relevantes superadas, incluidas cuatro de base de datos con usuarios y permisos diferentes. En navegador se han comprobado solicitudes, aceptación en el equipo, propuesta de revista, selección, publicación, retirada, enlace a proyecto y vista móvil sin desbordamiento horizontal.

En esta sesión la aplicación se ha iniciado en `http://127.0.0.1:3017`, ya que otros servicios ocupaban los puertos anteriores. El directorio de desarrollo alternativo se configura con `ENTRECLASE_DIST_DIR`; el valor por defecto continúa siendo `.next`.
