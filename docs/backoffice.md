# Backoffice de Entreclases

## Objetivo y alcance

El backoffice será el espacio privado del equipo de Entreclases para gestionar la comunidad, resolver incidencias y decidir qué destacar. Debe ayudar a actuar con contexto, mantener un historial de las decisiones y proteger la privacidad de los usuarios.

Este documento describe la propuesta de producto y el estado de la versión funcional del backoffice. La ruta `/backoffice/` usa la sesión autenticada y la RPC privada `universe_backoffice`; la ruta `/backoffice/?demo=1` mantiene datos ficticios para revisar el diseño sin tocar la base de datos.

### Primera versión disponible

El backoffice real se puede abrir en `/backoffice/` y en `/va/backoffice/`. La demo visual se abre añadiendo `?demo=1`. Incluye:

- Resumen con métricas de pendientes, denuncias, propuestas y participación.
- Moderación con una cola de casos y acción **Resolver**.
- Entre líneas con propuestas que se pueden aceptar o rechazar en la sesión.
- Personas, ClasiCoins y configuración como espacios preparados para la gestión diaria.
- Juegos con estado activo o pausado para controlar qué experiencias aparecen en Explorar.
- Búsqueda, navegación por secciones y diseño responsive con el lenguaje visual de Entreclases.

Las acciones de la demo no afectan a usuarios reales. En la ruta real, las decisiones se validan en Supabase, se guardan en la base de datos y dejan un registro de auditoría.

### Activar el acceso real

La migración está en `supabase/migrations/202609210015_backoffice.sql` y también se incluye en `supabase/setup.sql`. Hay que aplicarla en el proyecto Supabase después de las migraciones anteriores. Después se concede el primer rol desde el editor SQL, usando el correo de una cuenta que ya tenga perfil universitario:

```sql
insert into public.universe_backoffice_roles (user_id, role)
select p.user_id, 'admin'
from public.universe_profiles p
join auth.users u on u.id = p.user_id
where u.email = 'admin@universidad.es'
on conflict (user_id) do update set role = excluded.role, revoked_at = null;
```

Los roles disponibles son `admin`, `moderator`, `editor` y `support`. El servidor comprueba el rol con `auth.uid()`; nunca se acepta un rol enviado desde el navegador. Si la persona no tiene sesión o no tiene un rol vigente, `/backoffice/` muestra una pantalla de acceso y no carga datos internos.

### Operaciones que ya persisten

- Moderación: pasar una denuncia a revisión, resolverla, descartarla o escalarla con estado, prioridad, nota, responsable y fecha.
- Personas: crear advertencias, suspensiones o bloqueos temporales y revocar restricciones.
- Entre líneas: aceptar, rechazar o pedir cambios en una propuesta autorizada.
- Configuración: activar o pausar flags de Explorar y de los juegos.
- Auditoría: cada mutación guarda quién la hizo, qué recurso afectó, cuándo y con qué detalle.

El cliente usa `lib/backoffice/client.ts` y solo invoca la función `universe_backoffice`. Las tablas internas no tienen permisos directos para el navegador. Si Supabase todavía no tiene la migración aplicada, la pantalla real no muestra datos simulados: indicará que falta configurar el acceso.

## 1. Inicio: lo que necesita atención

La pantalla inicial reúne las tareas pendientes y lleva directamente a cada caso:

- Denuncias pendientes, con prioridad y tiempo de espera.
- Propuestas recibidas para Entre líneas y piezas pendientes de autorización.
- Planes cancelados e incidencias abiertas.
- Nuevos usuarios y participación reciente.
- Proyectos que buscan colaboradores.
- Fallos que impiden registrarse, publicar o conversar.

Cada aviso debe mostrar qué ha ocurrido, desde cuándo está pendiente, quién lo está atendiendo y cuál es la siguiente acción. Los datos deben indicar su periodo de referencia y cuándo se actualizaron.

## 2. Personas y acceso

### Ficha de usuario

Permite buscar por nombre, universidad o campus y consultar:

- Estado de la cuenta y de la verificación universitaria.
- Perfil público, publicaciones y participación en la comunidad.
- Incidencias, advertencias y sanciones anteriores, según los permisos del equipo.
- Historial de actuaciones internas.

Los datos públicos y las notas internas deben distinguirse claramente. Ninguna persona del equipo puede consultar contraseñas.

### Acciones disponibles

- Gestionar universidades, campus y dominios de correo admitidos.
- Resolver problemas de acceso y verificación mediante procedimientos definidos.
- Enviar advertencias vinculadas a un motivo concreto.
- Suspender temporalmente o bloquear cuentas, indicando motivo y duración cuando corresponda.
- Tramitar solicitudes de eliminación de cuenta.
- Asignar o retirar permisos del equipo del backoffice.

Las acciones sobre cuentas deben mostrar su alcance antes de ejecutarse. Una verificación no se debe conceder únicamente porque alguien pueda modificar un campo del perfil.

## 3. Moderación y convivencia

### Bandeja de casos

Una bandeja común reúne las denuncias de publicaciones, comentarios, perfiles, grupos y juegos. Los filtros permiten consultar estado, tipo de contenido, prioridad, antigüedad y responsable.

Cada caso incluye el contenido denunciado, el motivo, el contexto necesario y las actuaciones anteriores relevantes. Debe permitir asignar un responsable y añadir notas internas.

### Resolución

El moderador puede:

- Cerrar una denuncia sin actuación, dejando el motivo.
- Retirar contenido o solicitar una corrección.
- Advertir al autor.
- Aplicar una suspensión dentro de sus permisos.
- Escalar el caso a un administrador.

Estados propuestos: **pendiente → en revisión → resuelto**, con posibilidad de reabrir un caso si aparece información nueva.

### Privacidad y reclamaciones

- La identidad detrás de un juego anónimo queda reservada a moderadores autorizados cuando sea necesaria para resolver una denuncia. Su consulta debe quedar registrada.
- Las conversaciones privadas no forman un buzón de libre consulta para administradores. Su revisión parte del contenido reportado y se limita al contexto necesario, con acceso restringido y registrado.
- Una persona sancionada puede solicitar una revisión. Siempre que sea posible, otra persona del equipo revisará la reclamación.
- Las notificaciones al usuario explican la decisión y cómo reclamar sin revelar información privada de terceros.

## 4. Explorar: planes, grupos, proyectos y juegos

| Área | Gestión prevista | Límite de la intervención |
| --- | --- | --- |
| Planes y lugares | Categorías, puntos del mapa, duplicados, destacados, cancelaciones e incidencias. | Diferenciar los lugares de ejemplo de los verificados y comunicar las cancelaciones a los participantes. |
| Grupos | Categorías, visibilidad, grupos abandonados, denuncias y cambios de responsable justificados. | Respetar el acceso al contenido privado y registrar los cambios de responsable. |
| Proyectos | Puestos abiertos, etapas, destacados y propuestas engañosas o incompletas. | La incorporación al equipo sigue siendo una decisión de quien impulsa el proyecto. |
| Juegos | Activación, pausas, rondas, temas, límites de participación y denuncias. | Respetar consentimiento, anonimato, votos y reglas publicadas. |

### Control independiente de juegos

Cada juego debe poder activarse o pausarse por separado:

1. ¿Me lío?
2. Sin dar la cara.
3. Defiende lo indefendible.
4. Dos verdades y una trola.
5. Hay hueco.
6. El jurado del campus.
7. La cita empieza hablando.

Antes de pausar un juego debe quedar claro qué ocurrirá con las partidas en curso. La pausa no debe borrar automáticamente el historial ni modificar los resultados. Las funciones desactivadas deben mostrar un estado comprensible para el usuario.

## 5. Entre líneas: redacción y edición

### Flujo editorial

El recorrido habitual es:

**Propuesta recibida → revisión → cambios solicitados, si hacen falta → aceptada → programada → publicada.**

También existen propuestas rechazadas y autorizaciones retiradas. Los borradores aún no enviados permanecen bajo el control del autor.

Aceptar y publicar son acciones distintas. La programación debe guardar la edición, la fecha y la versión autorizada que se publicará.

### Herramientas de la redacción

- Revisar propuestas, imágenes, descripciones, pies de foto y créditos.
- Pedir cambios y responder a los autores.
- Gestionar portada, orden de piezas, secciones y archivo de ediciones.
- Previsualizar la edición en móvil y ordenador.
- Programar su publicación.
- Gestionar correcciones y retiradas de permiso.
- Consultar el historial de versiones y autorizaciones.

### Autorización del autor

La autorización corresponde a una versión concreta del texto, imágenes, atribución y lugares de aparición. Si se modifica esa versión, debe volver al autor para su aprobación antes de publicarse.

El permiso para la revista de la comunidad no autoriza automáticamente a usar la pieza en redes sociales, correos o una web pública. Las respuestas de otras personas y los mensajes privados no quedan cubiertos por el permiso del autor de una propuesta.

Cuando se retira una autorización, debe detenerse la publicación programada o retirarse la pieza de los lugares incluidos en ese permiso, también del archivo. El historial interno necesario para gestionar el caso tendrá acceso limitado.

### Seguimiento del autor

Desde «Mis propuestas», el usuario debe poder consultar el estado, las respuestas del equipo, los cambios solicitados y la edición en la que aparecerá su pieza cuando esté programada. El estado visible debe coincidir con la decisión registrada en el backoffice.

## 6. ClasiCoins

La gestión de ClasiCoins permite consultar:

- Saldo y movimientos de cada usuario.
- Motivo, fecha y origen de cada movimiento.
- Recompensas, costes y límites vigentes.
- Reembolsos por errores.
- Ajustes manuales justificados.
- Patrones que merezcan revisión, como respuestas repetitivas entre cuentas para obtener monedas.

Cada ajuste crea un movimiento nuevo con responsable y motivo. No se debe sustituir un saldo borrando el rastro anterior. Las sospechas de abuso requieren revisión antes de aplicar consecuencias.

Los cambios de reglas deben tener una fecha de entrada en vigor y no alterar silenciosamente los movimientos históricos.

## 7. Resultados y configuración

### Indicadores de utilidad

El panel debe mostrar si Entreclases ayuda a participar y conocer gente:

- Personas que se apuntan a su primer plan.
- Planes que consiguen participantes.
- Proyectos que incorporan colaboradores y alcanzan su primer hito.
- Participación en cada juego.
- Propuestas recibidas por Entre líneas.
- Solicitudes e inscripciones procedentes de la revista, cuando exista seguimiento para atribuirlas.
- Usuarios que vuelven durante un periodo definido.
- Denuncias pendientes y tiempo de resolución.

Una inscripción no demuestra asistencia. Para medir encuentros reales se necesitaría una confirmación posterior. Las métricas deben distinguir datos reales, datos de demostración y datos que todavía no se pueden medir.

### Configuración

- Universidades y campus del lanzamiento.
- Categorías disponibles.
- Textos informativos y avisos generales.
- Funciones activas y pausadas.
- Reglas de participación y ClasiCoins.
- Estado de los servicios necesarios para acceder y participar.

## Permisos del equipo

| Rol | Responsabilidad principal | Restricciones |
| --- | --- | --- |
| Administrador | Configuración general, permisos, incidencias escaladas y ajustes autorizados de ClasiCoins. | No tiene acceso indiscriminado a conversaciones privadas. |
| Moderador | Denuncias, retirada de contenido, advertencias y sanciones dentro de su alcance. | No modifica saldos ni gestiona permisos del equipo. |
| Editor de revista | Propuestas, ediciones, programación y archivo de Entre líneas. | No publica versiones sin autorización ni gestiona sanciones de cuentas. |
| Soporte | Problemas de acceso y seguimiento de incidencias. | No consulta contraseñas ni accede libremente a contenido privado. |

Los permisos deben comprobarse en cada operación, además de controlar qué botones aparecen. Un usuario normal no obtiene acceso al backoffice por conocer su dirección.

## Historial de actuaciones

Las sanciones, retiradas de contenido, cambios de permisos, consultas excepcionales de identidades anónimas y ajustes de monedas deben registrar:

- Quién realizó la acción y cuándo.
- Qué cuenta, contenido o configuración se vio afectada.
- Qué cambió y por qué.
- El caso o incidencia que justifica la actuación, cuando exista.

El historial no debe poder reescribirse desde las pantallas habituales. La conservación de datos personales y pruebas de moderación debe tener plazos definidos, acceso limitado y un procedimiento de eliminación.

## Experiencia de uso

- Navegación por las siete secciones principales.
- Búsqueda y filtros adecuados para cada lista.
- Fichas con contexto suficiente para decidir sin abrir muchas pantallas.
- Estado, responsable y siguiente paso visibles en las tareas pendientes.
- Confirmación que explique el efecto de las acciones delicadas.
- Respuesta clara al guardar, resolver, publicar o detectar un error.
- Diseño usable en pantallas pequeñas, aunque el trabajo editorial completo se realice principalmente desde ordenador.

## Primera versión y evolución

### Primera versión: operar el lanzamiento

Construir primero:

1. Acceso del equipo, roles e historial de actuaciones.
2. Inicio con tareas pendientes.
3. Personas y resolución de problemas de acceso.
4. Moderación y reclamaciones.
5. Redacción de Entre líneas y control de autorizaciones.
6. Movimientos y ajustes justificados de ClasiCoins.
7. Controles básicos para planes, grupos, proyectos y los siete juegos.

La primera versión estará lista cuando una persona autorizada pueda completar estos recorridos y el cambio se refleje correctamente para el usuario. Las restricciones deben funcionar aunque se intente ejecutar la operación fuera de la interfaz.

### Evolución posterior

- Más filtros e indicadores de participación.
- Seguimiento del efecto de los destacados y de las ediciones.
- Herramientas para revisar tareas en conjunto, con límites y confirmaciones adecuados.
- Ayuda de JEV para clasificar y priorizar casos, después de evaluar su funcionamiento.

## Posible papel de JEV

JEV podría sugerir la categoría de una denuncia, señalar casos que requieren atención o ayudar a clasificar propuestas editoriales. Su resultado sería una ayuda revisable para el equipo.

No sustituye los permisos, el consentimiento de los autores, las reglas de ClasiCoins ni la decisión editorial. Tampoco debe convertirse por defecto en un sistema de sanciones automáticas. El backoffice debe poder seguir funcionando si JEV no está disponible.

Antes de conectarlo habría que probar su precisión con ejemplos representativos en español y valenciano y definir qué información se enviaría al servicio. Este documento no activa ninguna integración ni envío de datos.

## Decisiones pendientes antes de construir

- Qué personas tendrán cada rol y qué sanciones podrá aplicar cada una.
- Motivos de denuncia, plazos de revisión y procedimiento de reclamación.
- Política de conservación de las pruebas y del historial interno.
- Tratamiento de partidas en curso al pausar un juego.
- Quién puede ajustar monedas y con qué límites.
- Calendario editorial y responsables de publicar cada edición.
- Qué indicadores se pueden obtener ya y cuáles necesitan nuevas mediciones.

## Documentos relacionados

- [Propuesta de Entreclases](entreclase-propuesta.md).
- [Configuración de la comunidad](community-setup.md).
- [Propuestas de revista](revista-propuestas.md).
- [Voz editorial de Entre líneas](entre-lineas-voz-editorial.md).
- [Reglas de ClasiCoins](unicoins.md).
