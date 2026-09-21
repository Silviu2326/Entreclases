import type { Letter } from "./types.ts";

// Step 0 is the welcome. When somebody joins after the doors are open there is
// no sequence left to promise, so the welcome has a second version.
export const welcomeOpen: Letter = {
 subject: "Ya está abierto. No esperes a nadie.",
 body: `Hola.

Te acabas de apuntar a la lista de Entreclases.

Te lo digo rápido porque llegas tarde, y en este caso llegar tarde es una buena noticia: Entreclases ya está abierto.

No hay nada que esperar. Entra con el correo de tu universidad y crea tu cuenta.

{{site}}

Si el correo con el que te has apuntado no es el de tu uni, pídele una invitación a alguien que ya esté dentro. Cada cuenta verificada puede traer a una persona.

Nos vemos dentro.

Silviu`,
};

export const letters: Letter[] = [
 {
  subject: "Ya estás dentro. Ahora la parte incómoda.",
  body: `Hola.

Te acabas de apuntar a Entreclases.

Antes de nada, una aclaración: no te he metido en una newsletter. Te he metido en una lista de gente que quiere entrar el 28 de septiembre.

Te voy a escribir siete mañanas seguidas, a las nueve.

Siete. No setenta.

Si te parece mucho, abajo del todo tienes el enlace para darte de baja. Un clic. Sin preguntas, sin encuesta de salida, sin «¿estás seguro?».

Prefiero una lista pequeña de gente que quiere estar, a una lista enorme de gente que me borra sin abrir.

Mañana a las nueve te cuento por qué monté esto. Tiene que ver con una mesa de la cafetería de Tarongers y con lo idiota que me sentí un jueves.

Silviu

P.D. Si el correo con el que te has apuntado no es el de tu universidad, ten a mano el bueno para el día 28. Ese día solo pasan las cuentas universitarias de Valencia y quien traiga una invitación de alguien de dentro.`,
 },
 {
  subject: "Conozco a media uni. Y a casi nadie.",
  body: `Tercero de carrera.

Me sabía la cara de doscientas personas.

El nombre de once.

Un jueves salí de clase, bajé a la cafetería y me senté solo. A dos mesas, cuatro de mi facultad estaban montando algo para el sábado. Los oía perfectamente.

No me giré.

Me comí el bocadillo mirando Instagram. Un desconocido en Bali. Una boda. Otro de veintidós años explicándome cómo ha ganado su primer millón.

Estaba rodeado de gente de mi edad, de mi campus y de mi carrera.

Y mi plan del sábado era ninguno.

Eso es lo que quiero arreglar. No con más contenido. Con un sitio donde lo normal sea cerrar el móvil y quedar con alguien.

Se llama Entreclases. Abre el 28 de septiembre en Valencia.

Mañana a las nueve: por qué esto no es otra red social, aunque lo parezca.

Silviu`,
 },
 {
  subject: "«Otra red social». Sí, ya.",
  body: `Te lo digo yo antes de que lo pienses tú.

Sí, es otra app. Y encima la monta alguien que se queja de las redes sociales. Muy coherente todo.

Pero hay una diferencia, y es la única que me importa.

Instagram gana cuando te quedas. Entreclases gana cuando te vas.

Si abres Entreclases, ves un plan, dices «me apunto» y cierras el móvil, ha funcionado.

Si te quedas cuarenta minutos haciendo scroll, ha fallado.

Por eso no hay muro infinito, ni cuentas recomendadas, ni un algoritmo decidiendo qué mereces ver.

Hay gente de tu campus. Planes con hora y sitio. Apuntes. Y un botón para decir que vas.

Mañana te cuento lo de los planes, que es el corazón de todo esto.

Silviu

P.D. No te voy a prometer veinte amigos nuevos. Te prometo una excusa para decir «hola» sin que sea raro. El resto lo haces tú, que para eso eres mayorcito.`,
 },
 {
  subject: "Un café en Benimaclet a las seis",
  body: `El plan más aburrido del mundo:

«Café en Benimaclet. Jueves a las seis. Caben cuatro.»

Ya está. Ese es el producto.

No hace falta montar un festival. No hace falta carisma. No hace falta una historia que contar.

Alguien pone un sitio y una hora. Otros dicen que sí.

Porque lo difícil de la universidad nunca fue conocer gente. Lo difícil era que alguien diera el primer paso.

En Entreclases ese paso es un botón.

Puedes proponer lo que quieras: estudiar juntos antes de un parcial, una vuelta por el Turia, la Malvarrosa un sábado, el atardecer en l'Albufera.

O puedes no proponer nada y apuntarte a lo que ya hay. También vale. Casi todo el mundo empieza así.

Mañana: por qué te voy a pedir el correo de la uni, y por qué eso es una buena noticia para ti.

Silviu`,
 },
 {
  subject: "No es para todo el mundo. Esa es la gracia.",
  body: `Internet ya tiene un sitio donde cabe cualquiera.

Se llama internet.

Entreclases empieza solo con correo universitario de Valencia. Pública o privada, me da igual, pero de aquí.

¿Por qué?

Porque lo único que convierte a un desconocido en alguien con quien puedes quedar es tener algo en común. Un campus. Una etapa. La posibilidad real de cruzaros al salir de clase.

Si abro la puerta a todo el mundo, en una semana esto es Wallapop con fotos de gente.

Ahora, la excepción. Cada cuenta universitaria verificada puede invitar a una persona de fuera. Una. Tu pareja, tu amigo del pueblo, tu hermana.

Y quien entra invitado no puede invitar a nadie más. Se corta ahí. Si no, la cadena se come la idea en un mes.

Mañana te hablo de las ClasiCoins, que es la parte que más me discuten.

Silviu`,
 },
 {
  subject: "Te voy a cobrar por publicar",
  body: `Aquí es donde alguno se da de baja. Adelante, sin rencores.

En Entreclases, crear un plan cuesta 10 ClasiCoins. Abrir un hilo cuesta 5. El primer hilo es gratis.

Pregunta obvia: ¿me vas a cobrar dinero?

No.

Las ClasiCoins no se compran, no se venden y no valen un euro. No hay tienda. No hay pasarela de pago. No existe el botón de «comprar monedas», y no va a existir.

Empiezas con 20 por completar tu perfil.

Ganas 2 por tu primera respuesta en el hilo de otra persona. Ganas 3 la primera vez que te apuntas al plan de alguien.

¿Y esto para qué sirve?

Para que publicar cueste algo. Lo que no cuesta nada se llena de ruido. Mira el grupo de WhatsApp de tu clase y me cuentas.

Si te quedas sin monedas, la manera de conseguir más no es pagar. Es ayudar a alguien.

Mañana: lo que viene después del 28.

Silviu`,
 },
 {
  subject: "El 12 de octubre abro Proyectos",
  body: `Tengo una idea fija.

En tu misma facultad hay alguien que programa, alguien que diseña y alguien que sabe vender. Y no se van a conocer nunca, porque comen en cafeterías distintas y nadie les ha presentado.

El 12 de octubre, dos semanas después de abrir, sale Proyectos.

Funciona así: publicas tu idea, dices qué puestos necesitas y, muy importante, qué pones tú. Alguien de otra carrera lo ve y te manda una solicitud privada. Tú aceptas o no.

Hay hitos, una conversación de equipo y, al terminar, un resultado con los créditos de todo el mundo. Cada uno decide si lo enseña en su perfil.

No es un tablón de «busco programador gratis para mi idea millonaria». Tienes que decir qué aportas tú.

Y hay una tercera fecha, el 26 de octubre, de la que todavía no puedo hablar.

Mañana el último de la serie. Te cuento exactamente qué hacer el día que entres.

Silviu`,
 },
 {
  subject: "El 28. Esto es lo que haces.",
  body: `Último correo de la serie. Gracias por llegar hasta aquí, de verdad.

El 28 de septiembre a las 00:00 abren las cuentas.

Esto es lo que haces el día que entres, por orden:

Uno. Entra con el correo de tu universidad. No el de Gmail. El de la uni.

Dos. Confirma el correo. Te llega un enlace, lo pulsas, ya está.

Tres. Completa el perfil. Ahí se te dan las 20 ClasiCoins.

Cuatro, y este es el que importa de verdad: apúntate al plan de otra persona el primer día. No montes el tuyo todavía. Apúntate al de alguien.

Es mucho más fácil decir «voy» que decir «venid». Empieza por lo fácil.

Y si el correo con el que te apuntaste a esta lista no es universitario, pídele la invitación a alguien que vaya a entrar. Cada cuenta verificada puede traer a una persona.

{{site}}

Nos vemos dentro.

Silviu

P.D. Te lo digo claro: los primeros días son los que deciden si un sitio así se llena o se queda en nada. Un plan vacío no convence a nadie. Prefiero que estés.`,
 },
];
