# Entreclases · Proyecto web

Esta copia incluye la landing animada, el registro y login, la aplicación web de la comunidad y ClasiCoins, en español y valenciano. La primera etapa está centrada en las universidades de Valencia.

## Arranque rápido

Necesitas Node.js 22.13 o superior y npm. El proyecto se ha probado con Node.js 24.

1. Extrae el ZIP y abre una terminal dentro de la carpeta raíz del proyecto.
2. Instala las dependencias y arranca el servidor:

```bash
npm ci
npm run dev
```

- Landing: http://localhost:3000/
- Aplicación de demostración: http://localhost:3000/demo/
- Versión en valenciano: http://localhost:3000/va/
- Demo en valenciano: http://localhost:3000/va/demo/
- Monedero ClasiCoins: http://localhost:3000/demo/?view=unicoins

La landing y la demo funcionan sin configurar Supabase. Los perfiles y contenidos de la demo son ejemplos; sus cambios no se conservan al recargar.

## Cuentas reales y datos persistentes

Configura la URL y la clave pública de Supabase, revisa Auth y activa `NEXT_PUBLIC_SUPABASE_AUTH_ENABLED=true` cuando la base de datos esté preparada. En instalaciones nuevas usa `supabase/setup.sql`; en una existente aplica únicamente las migraciones pendientes. Consulta primero [la guía de lanzamiento](docs/lanzamiento.md). Sin esa configuración no se crean cuentas ni se envían correos, y no hay saldos persistentes entre usuarios.

Sigue, por orden:

1. `docs/auth-setup.md`: variables públicas, correo, verificación y dominios universitarios admitidos.
2. `docs/community-setup.md`: tablas, permisos y almacenamiento de la comunidad.
3. `docs/unicoins.md`: reglas, límites y activación de ClasiCoins.

Las migraciones SQL están incluidas en `supabase/migrations/`. El archivo `.env.example` contiene los nombres de las variables necesarias, sin credenciales. Crea tu propio `.env.local` para la configuración local.

## Compilar y comprobar

```bash
npm run build
npm start
```

La compilación genera `out/`; `npm start` la sirve en http://localhost:3000/.

```bash
npm run test:auth
npm run lint
```

El script `test:auth` incluye también las pruebas de comunidad y ClasiCoins.

## Qué incluye esta versión

- Landing con narrativa, lugares de Valencia, animaciones y selector de idioma.
- Registro universitario, login, verificación y recuperación de contraseña.
- Feed y foro, eventos, grupos, apuntes, perfiles y mensajes privados.
- Saldo e historial de ClasiCoins, costes al crear e incentivos al participar.
- 20 ClasiCoins de bienvenida, coste de 10 por evento y 5 por hilo; recompensas de 3 por unirse a un evento ajeno y 2 por responder a un hilo ajeno, con límites y controles contra repeticiones.
- ClasiCoins no se compran, venden ni convierten en dinero: incentivan la participación.
- Código fuente, imágenes, fuentes y licencias, dependencias fijadas, documentación, migraciones y pruebas.

El README original conserva notas de entregas anteriores. Esta guía describe el alcance actual de la versión 8.

El archivo `.openai/hosting.json` conserva la configuración del sitio existente. No es necesario para ejecutar Next.js en local.

No se incluyen dependencias instaladas, compilaciones, historial de Git ni credenciales.
