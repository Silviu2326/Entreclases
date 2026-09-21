# Contrato técnico de los juegos

Cómo se programa un juego sobre la base compartida. Lo leen las siete implementaciones. El diseño de cada juego está en su propio documento de esta carpeta.

## Archivos que posee cada juego

Un juego solo escribe en estos tres archivos. No toca ningún otro.

| Archivo | Qué contiene |
| --- | --- |
| `lib/community/games/demo/<motor>.ts` | Las reglas y el estado de la demo. Exporta `play` |
| `components/community/games/<pantalla>.tsx` | La pantalla. Exporta `default` |
| `components/community/games/<pantalla>.css` | Sus estilos, con prefijo propio |

| Juego | Motor | Pantalla |
| --- | --- | --- |
| Sin dar la cara | `questions.ts` | `preguntas-anonimas` |
| La cita empieza hablando | `blind.ts` | `cita-a-ciegas` |
| ¿Me lío? | `crush.ts` | `me-lio` |
| Dos verdades y una trola | `truth.ts` | `dos-verdades` |
| Defiende lo indefendible | `debate.ts` | `defiende-lo-indefendible` |
| Hay hueco | `hangout.ts` | `hay-hueco` |
| El jurado del campus | `jury.ts` | `jurado-del-campus` |

## El motor de la demo

```ts
import { demoContext, type DemoContext } from "./store";
import type { GameWorld } from "../types";

type Store = { /* estado interno, vive mientras dure la pestaña */ };
export type State = { /* lo que ve la pantalla */ };

export function play(world: GameWorld, command: string, input: Record<string, unknown>): State {
  const ctx = demoContext<Store>("hangout", world, context => seed(context));
  switch (command) {
    case "read": break;
    case "create": /* ... */ break;
    default: ctx.fail("Acción desconocida.", "Acció desconeguda.");
  }
  return view(ctx);
}
```

- `play` es **síncrona** y devuelve **siempre el estado completo** después de aplicar el comando. La pantalla no compone estados: pinta lo que recibe.
- El comando `"read"` no cambia nada.
- Para rechazar algo, `ctx.fail("mensaje en español", "missatge en valencià")`. El texto se le muestra a la persona tal cual.
- Nada de `async`, `fetch`, `localStorage` ni `Date` fuera de `ctx.now()`.

`DemoContext` ofrece:

| Miembro | Para qué |
| --- | --- |
| `ctx.world` | El mundo: `me`, `people`, `groups`, `locale`, `t` |
| `ctx.store` | El estado interno, mutable |
| `ctx.t(es, va)` | Texto en el idioma activo |
| `ctx.me` | Quien juega, como `GamePerson` |
| `ctx.id()` | Un identificador nuevo |
| `ctx.now()` | Milisegundos actuales |
| `ctx.pick(lista, semilla)` | Elemento estable de una lista, para contenido de ejemplo |
| `ctx.fail(es, va)` | Rechaza la acción |

La demo debe **sembrar contenido creíble**: personas del mundo ya participando, algo que jugar desde el primer segundo. Además ofrece acciones marcadas como **Demo** para simular a la otra persona (una respuesta, un turno, un voto, una coincidencia), porque en la demo no hay nadie al otro lado.

## Tipos compartidos

De `@/lib/community/games/types`:

```ts
type GameKind = "crush" | "questions" | "debate" | "truth" | "hangout" | "jury" | "blind";
type AudienceKind = "campus" | "site" | "degree" | "course" | "group" | "contacts" | "person";
type Audience = { kind: AudienceKind; ref?: string };
type GameRoom = { id, owner, owner_name, mine, audience, anon, created_at, expires };
type GamePerson = { id, name, campus, degree, year, bio, interests, groups, contact };
type GameGroup = { id, name, members };
type GameWorld = { locale, t, me, people, groups };
const minAnonymousAudience = 8;
const nowIso, inMinutes, inHours, past, minutesLeft;
```

De `@/lib/community/games/audience`:

```ts
inAudience(person, audience, world): boolean
audienceReach(audience, world): number
audienceLabel(audience, world): string
audienceChoices(world, kinds, anonymous?): AudienceChoice[]
```

`GameRoom` es la base común de cualquier cosa creada dentro de un juego. Cada juego define su propio tipo encima: `type Hueco = GameRoom & { place: string; ... }`.

## La pantalla

```tsx
"use client";
import { GameShell, useGame } from "./shared";
import { GameHead, Tiles /* … */ } from "./ui";
import type { State } from "@/lib/community/games/demo/hangout";
import "./hay-hueco.css";

export default function HayHueco() {
  const g = useGame<State>("hangout");
  return <GameShell game={g}>{g.state && <div className="g-hangout">…</div>}</GameShell>;
}
```

`useGame<State>(kind)` devuelve:

| Miembro | Para qué |
| --- | --- |
| `g.state` | El estado, o `null` mientras carga |
| `g.world` | El mundo, para los destinatarios |
| `g.t(es, va)` | Texto en el idioma activo |
| `g.me`, `g.person(id)` | Perfiles completos, con foto |
| `g.act(comando, datos)` | Ejecuta un comando. Devuelve si salió bien |
| `g.busy`, `g.loading`, `g.error`, `g.demo` | Estado de la conexión |
| `g.chat(idPersona)` | Abre una conversación privada y navega a ella |
| `g.go(vista)` | Navega, por ejemplo a `"groups"` |
| `g.refresh()` | Vuelve a leer |

`GameShell` ya pinta el aviso de demo, los errores y la carga. La pantalla solo pinta el juego.

## Primitivas de interfaz

De `./ui`. Están pensadas para no escribir formularios:

| Primitiva | Para qué |
| --- | --- |
| `GameHead` | Título y explicación del juego |
| `Steps` | El raíl de pasos de un recorrido de creación |
| `Tiles` | Opciones grandes que se tocan, con icono. Sustituyen a los desplegables |
| `AudiencePicker` | El selector de destinatarios común, con el recuento de personas |
| `Suggestions` | Sugerencias de texto, con botón de barajar |
| `Countdown` | Reloj con anillo |
| `Deck` | Una carta cada vez, con la posición en la pila |
| `PersonLine` | Foto, nombre y detalle |
| `Bar` | Barra de resultado con porcentaje |
| `IdentityNote` | La línea que dice quién te va a ver |
| `Nothing` | Pantalla vacía con salida |
| `Segmented` | Interruptor de dos o tres valores |
| `Conversation`, `Bubble`, `Composer` | Chat con autoscroll y respuestas rápidas |
| `useTick(ms)` | Repinta cada cierto tiempo, para los relojes |

De `../controls`: `Action`, `Avatar`, `Confirm`, `Modal`. De `lucide-react`, los iconos.

## Reglas de escritura

1. **Español y valenciano siempre.** Todo texto visible pasa por `g.t(es, va)` o `ctx.t(es, va)`. **No se toca `lib/community/copy.ts`**, que lo está editando otra persona.
2. **Nada de formularios de varios campos.** Una decisión por pantalla, con `Steps` cuando haya más de una.
3. **Tocar antes que escribir.** Donde haya que escribir, `Suggestions` encima.
4. **Estados visibles.** La pantalla cambia entera según el estado; no es una lista que crece.
5. **Siempre una salida.** Todo juego desemboca en un chat privado, un plan, un grupo o un perfil.
6. **Accesible.** Botones reales, `aria-pressed` en lo que se selecciona, `role="status"` en los resultados, foco visible, 44 píxeles de alto mínimo en lo que se toca.
7. **CSS propio con prefijo.** `.g-hangout`, `.g-hangout-seat`. Define `--g-accent` y `--g-soft` en la raíz del juego. Móvil a 400 píxeles incluido.
8. **Sin dependencias nuevas.** Solo lo que ya usa el proyecto.
9. **Comentarios en inglés**, como el resto del código, y solo donde expliquen un porqué.
10. **Compila.** `npx tsc --noEmit -p tsconfig.json` no debe añadir errores en los archivos del juego.

## Alcance

Se implementa **la experiencia completa en la demo**. El camino de cuentas reales llama a `universe_play_v2`, que todavía no existe en Supabase: hasta que exista, esas cuentas ven el aviso de «no activado», que `GameShell` ya pinta. El servidor es un trabajo aparte.

Los avisos al Buzón quedan fuera por ahora: los está construyendo otra persona. Donde el diseño pida un aviso, el juego lo resuelve dentro de su propia pantalla.
