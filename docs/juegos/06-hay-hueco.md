# Hay hueco

Tienes un rato libre. Alguien en el campus también. Os veis ahora.

Lee antes `00-conceptos-comunes.md`: destinatarios, identidad y avisos se definen allí.

## La idea

Los planes normales de la aplicación se organizan con días de antelación. Hay hueco es lo contrario: cubre el rato muerto entre dos clases, la hora de comer sin compañía, la tarde de biblioteca que sería mejor con alguien. Es el único de los siete juegos que termina siempre con personas viéndose en persona, y por eso es el más importante para la idea de Entreclases.

El objeto del juego es **un hueco en el mapa con plazas y un reloj**.

Todo en este juego tiene que ser rápido. Si abrir un hueco cuesta más de quince segundos, el rato libre se acaba antes.

## Quién ve mi hueco

| Destinatario | Cuándo tiene sentido |
| --- | --- |
| Mi sede | Opción por defecto. Un hueco solo sirve a quien está cerca |
| Mi curso o mi carrera | Un café con compañeros después de clase |
| Un grupo | Avisar al grupo de que estoy en la cafetería |
| Mis contactos | Gente que ya conozco |
| Una persona | Invitar a alguien concreto. Es lo que usan ¿Me lío? y La cita para proponer quedar |
| Todo el campus | Solo para huecos que no dependen del sitio, como un paseo por el centro |

Los huecos van siempre con nombre y foto. Nadie se apunta a tomar un café con alguien anónimo.

## Cómo se usa

### Abrir un hueco

Cuatro toques, sin escribir nada si no se quiere:

1. **Qué.** Fichas con icono: café, comer, estudiar, pasear, deporte, otra cosa. Solo «otra cosa» pide texto.
2. **Dónde.** Los sitios habituales de mi sede como fichas: cafetería, biblioteca, césped, entrada principal. También se puede escribir otro sitio. Los sitios salen del mapa del campus que ya existe.
3. **Cuándo y cuánto.** Ahora, en quince minutos, en media hora o a una hora concreta de hoy. Duración: de quince minutos a dos horas.
4. **Con quién y cuántos.** El destinatario y las plazas, de dos a ocho contándome a mí.

Se puede añadir una nota corta: «estoy en la mesa del fondo, llevo sudadera verde».

### Encontrar un hueco

Dos vistas de lo mismo:

- **Ahora.** Tarjetas ordenadas por cercanía en el tiempo: qué, dónde, en cuánto empieza, quién va y cuántas plazas quedan. Un botón: **Me apunto**.
- **Mapa.** Los huecos abiertos sobre el mapa del campus, con el mismo componente de mapa que ya usa la aplicación.

Si no hay ninguno, la pantalla no queda vacía: «Nadie ha abierto hueco todavía. Si lo abres tú, avisamos a tu sede.»

### Durante el hueco

Al apuntarme, la pantalla pasa a ser la del hueco:

- **El reloj.** Cuenta atrás hasta que empieza y después tiempo restante.
- **Quién viene.** Las fotos de los apuntados y las plazas libres.
- **El chat del hueco.** Solo para los apuntados. Tres respuestas rápidas encima del teclado: «Voy de camino», «Ya estoy aquí», «Llego cinco minutos tarde».
- **Ya estoy aquí.** Marca mi foto con un punto verde. Encontrarse con desconocidos es la parte difícil, y esto la resuelve.
- **Me tengo que ir.** Libera mi plaza y avisa al resto.

Quien abrió el hueco puede cerrarlo, ampliarlo media hora o cambiar el sitio. Un cambio de sitio avisa a todos.

### Después

Cuando el tiempo termina, el hueco desaparece de las listas. A cada persona que marcó «ya estoy aquí» se le pregunta una sola cosa: **«¿Repetimos?»**, con las fotos de los demás.

- Tocar una foto la añade a mis contactos si ella también me toca a mí.
- Si todo el hueco quiere repetir, se ofrece crear un grupo con un toque.

Es el paso que convierte un café casual en gente conocida.

## Estados

| Estado | Pantalla |
| --- | --- |
| Abierto, sin empezar | Tarjeta con cuenta atrás y plazas |
| En marcha | El reloj, quién ha llegado y el chat |
| Completo | Visible, con «Completo» y sin botón |
| Terminado | Desaparece. Solo queda «¿Repetimos?» para quienes fueron |
| Cerrado por quien lo abrió | Aviso a los apuntados |

## Avisos

Son la clave del juego: un hueco que nadie ve a tiempo no sirve.

- «Laura ha abierto hueco: café en Tarongers, en quince minutos.» Solo al destinatario elegido, y solo a quien tenga activados los avisos de huecos.
- «Alguien se ha apuntado a tu hueco.»
- «Tu hueco empieza en cinco minutos.»
- «Han cambiado el sitio de tu hueco.»

Para no saturar, cada persona elige de quién quiere avisos de huecos nuevos: mis contactos, mi curso, toda mi sede o nadie. Por defecto, contactos y curso.

## Reglas y seguridad

- Un hueco abierto a la vez por persona. Se puede estar apuntado a un máximo de dos huecos que se solapen.
- De quince minutos a dos horas, siempre dentro del día.
- Sitios públicos. Las sugerencias son todos lugares del campus o muy concurridos. El juego lo recuerda la primera vez.
- El chat del hueco se borra a las 24 horas de terminar.
- Quien se apunta y no aparece varias veces recibe un aviso privado. No hay puntuación pública de asistencia.

## Qué hay hoy y qué cambia

| Hoy | Con este diseño |
| --- | --- |
| Todo hueco lo ve todo el campus | Seis destinatarios, con mi sede por defecto |
| Un formulario con cuatro campos | Cuatro toques con fichas, sin escribir |
| El hueco empieza siempre ahora | Ahora, en un rato o a una hora de hoy |
| Una lista de huecos | Vista «Ahora» y vista de mapa |
| Un chat para los apuntados | Se mantiene, con respuestas rápidas y «ya estoy aquí» |
| Nadie se entera si no entra a mirar | Avisos a quien corresponde, configurables |
| El hueco desaparece y no queda nada | «¿Repetimos?», contactos y grupo |
| Plazas y chat privado comprobados en la base de datos | Se mantiene |

Por debajo hace falta: el destinatario en cada sala, la hora de inicio además de la de fin, la lista de sitios por sede, el estado «ya estoy aquí», los avisos con sus preferencias y el paso final de contactos.

## Decisiones pendientes

1. **¿Se usa la ubicación del teléfono?** Recomendación: no. La sede del perfil y los sitios con nombre bastan, y se evita pedir un permiso delicado.
2. **¿Los huecos para una sola persona aparecen como invitación?** Recomendación: sí. Llegan al Buzón con aceptar o declinar, y no se muestran en ninguna lista.
3. **«Mis contactos».** Este juego es el que más contactos genera. Conviene cerrar aquí la decisión común sobre qué es un contacto.
