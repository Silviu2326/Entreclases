# Calendario de prelanzamiento · 22/09 – 28/09

Cada carpeta de día tiene todo lo necesario para subirlo. Abre su `PUBLICAR.md`: ahí están los textos de Instagram y TikTok, el orden de las historias y los stickers que hay que añadir a mano (encuestas, quiz, preguntas, cuenta atrás y enlaces).

| Día | Instagram | TikTok | Historias |
|---|---|---|---|
| [22-09](22-09/PUBLICAR.md) mar | Anuncio ya publicado: fijarlo | Vídeo anuncio con voz (28 s) | 5 · encuesta, cuenta atrás, enlace |
| [23-09](23-09/PUBLICAR.md) mié | Reel «Sales de clase» con voz + portada | El mismo Reel | 4 · encuesta de 3 opciones, enlace |
| [24-09](24-09/PUBLICAR.md) jue | Carrusel de 7 «Qué puedes hacer» | Carrusel en vídeo con voz (23 s) | 6 · encuesta de 4 opciones, una historia por sección, enlace |
| [25-09](25-09/PUBLICAR.md) vie | Vídeo de los juegos: ¿Me lío? y La cita empieza hablando (Reel de las cuatro situaciones, de reserva) | El mismo vídeo | 4 · caja de preguntas, plantilla de respuestas, enlace |
| [26-09](26-09/PUBLICAR.md) sáb | Carrusel de 8 «No tienes que conocer a nadie» | Carrusel en vídeo con voz (31 s) | 4 · quiz, respuesta, enlace |
| [27-09](27-09/PUBLICAR.md) dom | Carrusel FAQ de 7 | FAQ en vídeo con voz (45 s) | 6 · cuenta atrás, FAQ, caja de preguntas, enlace |
| [28-09](28-09/PUBLICAR.md) lun | Carrusel de lanzamiento de 4 | Vídeo de lanzamiento con voz (28 s) | 6 + 1 grabada ese día · encuesta, enlaces |

Formatos: historias y vídeos a 1080×1920; carruseles a 1080×1350 (4:5). Los vídeos van a 30 fps, H.264 + AAC, a −14 LUFS, con la voz de ElevenLabs «Gabriel Blanco».

## Antes de publicar

- **28/09:** el registro tiene que estar activado en la web antes de publicar nada ese día (ver `28-09/PUBLICAR.md`).
- **Ejemplos:** los nombres (Laia, Pau, Ana, Marc, Sara), grupos y planes son de ejemplo. Ninguna pieza usa cifras reales de registro.
- **Proyectos:** siempre aparece con «llega el 12/10».
- **FAQ:** la primera respuesta dice cómo se entra de verdad: correo de una universidad de Valencia o invitación de alguien de dentro.

## Carpetas de trabajo

- `_recursos/`: las 15 imágenes de campaña.
- `_fuente/`: todo lo que genera las piezas.
  - `dia-XX.html`: historias y carruseles de cada día. `python render_static.py dia-26.html` los vuelve a exportar a su carpeta.
  - `video-XX.html`: vídeos de TikTok. `python render_video.py video-26.html 26-09/tiktok/tiktok-26-09.mp4` los vuelve a renderizar. La voz se genera con ElevenLabs si cambia una frase (hace falta la variable de entorno `XI_KEY`) y queda guardada en `voz/`.
  - `carrusel-24/`, `reel-23/`, `reel-25/`: las piezas hechas antes, con su propio script.
- `pdf/`: manual de la plataforma (no forma parte del calendario).
