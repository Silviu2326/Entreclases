# Catálogos de gustos

La estantería del perfil permite añadir series, películas, juegos y música. El buscador guarda el identificador del catálogo, el título, el año, la fuente y una carátula estable; no descarga ni almacena el contenido audiovisual.

## Fuentes conectadas

- **TMDB**: películas y series. Configura `NEXT_PUBLIC_TMDB_KEY`.
- **OMDb**: películas con búsqueda y póster. Configura `NEXT_PUBLIC_OMDB_KEY`; si no está disponible, se usa Wikidata + Wikimedia Commons.
- **TVMaze**: series como alternativa abierta cuando no hay clave de TMDB. Configura `NEXT_PUBLIC_TVMAZE_KEY` solo si tu proveedor te la solicita; el endpoint público de TVMaze funciona sin ella.
- **Wikidata + Wikimedia Commons**: películas sin coste de licencia de API. La cobertura de pósteres depende de que exista una imagen reutilizable en Commons.
- **IGDB**: videojuegos. Configura `NEXT_PUBLIC_IGDB_CLIENT_ID` y un `NEXT_PUBLIC_IGDB_ACCESS_TOKEN` de corta duración. El secreto de Twitch no debe entrar en el navegador.
- **RAWG**: videojuegos como alternativa práctica. Configura `NEXT_PUBLIC_RAWG_KEY` con una clave pública de [su API](https://rawg.io/apidocs).
- **Spotify**: álbumes. Configura opcionalmente `NEXT_PUBLIC_SPOTIFY_ACCESS_TOKEN`; el token se utiliza solo para buscar y debe renovarse fuera de la aplicación.
- **MusicBrainz**: álbumes y artistas. No necesita clave y funciona como respaldo de Spotify. Respeta su límite de una petición por segundo.

Cuando falta una credencial o un proveedor no responde, el selector muestra la lista local de Entreclases. Así el perfil continúa funcionando en la demo y durante una caída temporal.

## Configuración

1. Copia `.env.example` a `.env.local`.
2. Añade las credenciales de los proveedores que tengas aprobadas.
3. Reinicia el servidor de desarrollo para que Next.js lea las variables.

TMDB exige atribución en la aplicación. TVMaze, IGDB, Spotify y MusicBrainz tienen condiciones propias de uso y límites de llamadas; la pantalla de créditos de Entreclases debe conservar la atribución de los proveedores antes de publicar el producto.

La aplicación está exportada como sitio estático. Por eso las búsquedas que requieren credenciales usan variables públicas y de corta duración. Para producción conviene mover IGDB y Spotify a un proxy del servidor que mantenga sus secretos fuera del navegador; el modelo de `Taste` y el selector no necesitan cambiar.
