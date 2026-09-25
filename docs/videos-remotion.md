# Vídeos verticales con Remotion

Cómo pasar el motor de vídeos de `output/_fuente/` (HTML + `render(t)` + Playwright + ffmpeg) a Remotion, manteniendo el mismo resultado: 1080×1920 a 30 fps, marca de Entreclases, locución de ElevenLabs que marca los tiempos, y planos que se encadenan sin pausas.

## Por qué Remotion

El motor actual y Remotion son la misma idea: una función que, dado un instante, dibuja el fotograma. Lo que aporta Remotion:

- **Studio**: previsualización en el navegador con barra de tiempo. Se ajusta un plano en vivo en vez de esperar dos minutos de render.
- **Componentes**: un sello, una nota a mano o una tarjeta se escriben una vez y se reutilizan en todos los vídeos.
- **Render integrado**: `npx remotion render` hace lo que hoy hacen Playwright + ffmpeg, en paralelo y más rápido.

Licencia: gratuita para personas y empresas de hasta tres personas; a partir de ahí requiere licencia de empresa. Comprobarlo en remotion.dev/license antes de usarlo en una sociedad.

## Instalación

Requiere Node 22 (el mismo que el proyecto) y ffmpeg en el PATH (Remotion trae el suyo, pero se usa el del sistema para la normalización de volumen).

```sh
cd output
npx create-video@latest videos   # plantilla "Blank"
cd videos
npm i @remotion/google-fonts @remotion/media-utils
```

Estructura propuesta:

```
output/videos/
  public/
    brand/        ← copia de universe/public/brand (mark y wordmark)
    fonts/        ← inter-latin.woff2 y caveat-latin.woff2
    voz/          ← mp3 generados + manifest.json (ver «Voz»)
  src/
    Root.tsx      ← registra una Composition por vídeo
    brand.ts      ← tokens de color y tipografía
    motion.ts     ← curvas y ayudas (p, eOut, eBack…)
    ui/           ← Titular, Nota, Sello, Tarjeta, Cartera, Progreso
    videos/
      clasicoins.tsx
      entre-lineas.tsx
  scripts/
    voz.mjs       ← genera las locuciones y el manifest
```

## Marca

`src/brand.ts` copia los tokens de `app/globals.css` para que ningún vídeo invente colores:

```ts
export const brand = {
  plum: "#2a172e", cream: "#f9f7f1", paper: "#fffefa", lime: "#e1ff3e",
  muted: "#6e6470", teja: "#b0432f", ink: "#1c0e1f",
};
```

Las fuentes van con `@font-face` sobre `staticFile`, igual que en la web (Inter variable y Caveat), en un CSS global importado desde `Root.tsx`:

```css
@font-face { font-family: "Inter"; src: url("/fonts/inter-latin.woff2") format("woff2"); font-weight: 100 900; }
@font-face { font-family: "Caveat"; src: url("/fonts/caveat-latin.woff2") format("woff2"); font-weight: 600; }
```

Remotion espera a que las fuentes carguen antes de capturar si se usa `delayRender`; con `@font-face` y `document.fonts.ready` en un `useEffect` del componente raíz basta.

## Correspondencia con el motor actual

| Motor actual (`engine.js` / `video-24-revista.html`) | Remotion |
| --- | --- |
| `window.render(t)` | `useCurrentFrame()` y `useVideoConfig().fps`; `t = frame / fps` |
| `<section class="scene" data-voice data-min>` | `<Sequence from={inicio} durationInFrames={dur}>` |
| `p(t, a, b)` | `interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })` |
| `eOut`, `eInOut` | `Easing.out(Easing.cubic)`, `Easing.inOut(Easing.cubic)` en la opción `easing` de `interpolate` |
| `eBack` (rebote al entrar) | `spring({ frame, fps, config: { damping: 12, stiffness: 180 } })` |
| `eBounce` (la moneda que cae) | `Easing.bounce` |
| Titular palabra a palabra (`.w > i`) | Componente `Titular`: divide en palabras y aplica `translateY` con retardo por índice |
| `.pop` con `data-at` | Componente `Pop at={segundos}` que envuelve cualquier hijo |
| Cartera persistente fuera de los planos | Componente fuera de las `Sequence`, que lee el `frame` global y una lista de movimientos |
| `TIMES` inyectado por Python | `calculateMetadata` lee `voz/manifest.json` y calcula inicio y duración de cada plano |
| Playwright + ffmpeg | `npx remotion render` |

El código de `motion.ts` puede ser literalmente el de `engine.js`, tipado:

```ts
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const p = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const eOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const eInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const eBack = (x: number) => { const c1 = 1.55, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
```

Se puede trabajar en segundos dentro de cada plano, como ahora, con un hook:

```ts
export function useT() { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return f / fps; }
```

Dentro de una `Sequence`, `useCurrentFrame()` ya es relativo al inicio de la secuencia, así que `useT()` devuelve el `u` del motor actual.

## Voz: la locución marca los tiempos

Igual que en `render_video.py`, la duración de cada plano sale del audio. El script `scripts/voz.mjs` hace lo que hoy hace `tts()`:

1. Lee el guion del vídeo (lista de planos con `voice` y `min`).
2. Para cada frase sin mp3 en caché, llama a ElevenLabs con la voz `RwzBDEn5f6FIgpAjH9YN`, modelo `eleven_multilingual_v2`, `style` 0,6 y `stability` 0,3 (los ajustes que dieron la lectura viva). La clave se lee de `XI_KEY`; nunca se escribe en el repositorio.
3. Recorta el silencio de los bordes con ffmpeg (`silenceremove` en los dos sentidos, umbral −42 dB) y guarda `voz/<hash>.mp3`.
4. Mide la duración y escribe `public/voz/manifest.json`:

```json
{ "entre-lineas": [
  { "voice": "Ayer te dije que te iba a cobrar por publicar.", "file": "voz/3f1a….mp3", "seconds": 2.2, "min": 2.2 },
  { "voice": "Hoy vengo a contradecirme.", "file": "voz/9c0b….mp3", "seconds": 1.2, "min": 1.9 }
] }
```

El guion vive en el propio componente del vídeo, como un array, para que texto, mínimo y escena estén juntos:

```ts
export const planos = [
  { id: "ayer", voice: "Ayer te dije que te iba a cobrar por publicar.", min: 2.2 },
  { id: "hoy", voice: "Hoy vengo a contradecirme.", min: 1.9 },
  // …
] as const;
```

`scripts/voz.mjs` importa ese array (o lo lee de un JSON exportado) para saber qué generar. Regla práctica: cambiar una frase genera solo esa frase; el resto sigue en caché.

### Tiempos de cada plano

Constantes del ritmo actual: `LEAD = 0.12` s antes de la voz, `TAIL = 0.22` s después, `TEMPO = 1.1` (la voz se reproduce un 10 % más rápida con `playbackRate`).

```ts
export function calcularTiempos(manifest: Plano[], fps: number) {
  let t = 0;
  return manifest.map((pl, i, arr) => {
    const voz = pl.seconds / TEMPO;
    let dur = Math.max(pl.min, LEAD + voz + TAIL);
    if (i === arr.length - 1) dur += 1.2;               // aire al final, como ahora
    const r = { from: Math.round(t * fps), durationInFrames: Math.round(dur * fps), audioAt: Math.round((t + LEAD) * fps) };
    t += dur;
    return r;
  });
}
```

`calculateMetadata` de la `Composition` carga el manifest, calcula los tiempos y fija `durationInFrames` al total. Así Studio y el render conocen la duración sin tocar nada a mano:

```tsx
<Composition
  id="entre-lineas"
  component={EntreLineas}
  width={1080} height={1920} fps={30}
  durationInFrames={1}
  calculateMetadata={async () => {
    const manifest = await fetch(staticFile("voz/manifest.json")).then((r) => r.json());
    const tiempos = calcularTiempos(manifest["entre-lineas"], 30);
    const total = tiempos.at(-1)!.from + tiempos.at(-1)!.durationInFrames;
    return { durationInFrames: total, props: { manifest: manifest["entre-lineas"], tiempos } };
  }}
/>
```

## El vídeo

Cada vídeo es un componente que recorre los planos y monta una `Sequence` por plano con su audio:

```tsx
export const EntreLineas: React.FC<{ manifest: Plano[]; tiempos: Tiempo[] }> = ({ manifest, tiempos }) => (
  <AbsoluteFill style={{ background: brand.plum, fontFamily: "Inter" }}>
    {manifest.map((pl, i) => (
      <Sequence key={pl.id} from={tiempos[i].from} durationInFrames={tiempos[i].durationInFrames + 12 /* solape para la transición */}>
        <Plano entrada={escenas[i].entrada}>{escenas[i].contenido}</Plano>
        <Sequence from={tiempos[i].audioAt - tiempos[i].from}>
          <Audio src={staticFile(pl.file)} playbackRate={TEMPO} />
        </Sequence>
      </Sequence>
    ))}
    <Cartera movimientos={movimientos} tiempos={tiempos} />   {/* persiste entre planos */}
    <Progreso />
  </AbsoluteFill>
);
```

`Plano` reproduce las entradas del motor actual (barrido con filo lima, círculo, empuje lateral) con `clipPath` y `transform` sobre `useT()`:

```tsx
export const Plano: React.FC<{ entrada: "none" | "wipe" | "circle" | "push"; fondo?: string; children: React.ReactNode }> = ({ entrada, fondo = brand.cream, children }) => {
  const u = useT();
  const x = eInOut(p(u, -0.02, 0.3));
  const style: React.CSSProperties = { background: fondo };
  if (entrada === "wipe") style.clipPath = `inset(${(1 - x) * 100}% 0 0 0)`;
  if (entrada === "circle") style.clipPath = `circle(${x * 2300}px at 540px 1140px)`;
  if (entrada === "push") style.transform = `translateX(${(1 - eOut(p(u, -0.02, 0.36))) * 1080}px)`;
  return (
    <AbsoluteFill style={style}>
      {children}
      {entrada === "wipe" && x > 0 && x < 1 && <div style={{ position: "absolute", left: 0, right: 0, height: 24, background: brand.lime, top: (1 - x) * 1920 }} />}
    </AbsoluteFill>
  );
};
```

### Componentes de interfaz

Los mismos que ya existen en CSS, convertidos en componentes con el tiempo dentro:

- **`Titular`**: divide el texto en palabras; cada palabra sube desde `translateY(112%)` con retardo `0.12 + i * 0.045` s. Acepta un tramo marcado (`<mark>`) que dibuja el subrayado lima con `scaleX` desde la izquierda.
- **`Nota`**: texto en Caveat, girado, con `at` en segundos. Sube 26 px al aparecer.
- **`Pop`**: envuelve cualquier cosa y la hace entrar con `spring` (equivale a `.pop` con `data-at`).
- **`Sello`**: el «NO» o «SÍ» girado que cae de `scale(2.4)` a `1` en 0,18 s.
- **`Tarjeta`**: fondo blanco, radio 30, sombra suave; base de precios, formularios y titulares.
- **`Cartera`**: fuera de los planos. Recibe una lista `{ atFrame, delta }`; el saldo corre hasta el nuevo valor en 0,5 s y la pastilla da un botecito, como en el vídeo de las ClasiCoins.
- **`Progreso`**: la barra de arriba, `scaleX(frame / durationInFrames)`.

Ejemplo completo de un plano (la etiqueta de precio con el cero):

```tsx
const PlanoGratis = () => {
  const u = useT();
  const golpe = Math.sin(p(u, 0.95, 1.4) * Math.PI) * 0.18;
  return (
    <>
      <Titular size="l" top={330}>Publicar <mark>gratis.</mark></Titular>
      <Pop at={0.6} rot={-1.5}>
        <Tarjeta style={{ left: 160, top: 820, width: 760, textAlign: "center", padding: "54px 48px 50px" }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: ".12em", color: brand.muted }}>PRECIO POR PIEZA</div>
          <div style={{ fontSize: 300, fontWeight: 850, letterSpacing: "-0.09em", lineHeight: 0.9, transform: `scale(${1 + golpe})` }}>0</div>
          <div style={{ fontSize: 40, fontWeight: 800 }}>ClasiCoins</div>
        </Tarjeta>
      </Pop>
      <Nota at={1.9} left={520} top={1560} rot={-5}>yo también flipé.</Nota>
    </>
  );
};
```

Los textos que se escriben letra a letra (el formulario de propuestas) se hacen con `text.slice(0, Math.floor((u - a) * cps))`, igual que ahora.

## Previsualizar y renderizar

```sh
XI_KEY=… node scripts/voz.mjs entre-lineas      # genera las voces que falten y el manifest
npx remotion studio                              # previsualización con barra de tiempo
npx remotion render entre-lineas out/entre-lineas.mp4 --codec h264 --crf 20
ffmpeg -i out/entre-lineas.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 160k out/entre-lineas-final.mp4
```

El último paso deja el volumen al nivel habitual de Instagram y TikTok, como hace hoy `render_video.py`. Remotion no normaliza sonoridad por sí mismo.

En Windows la variable se define como `$env:XI_KEY="…"` en PowerShell o `export XI_KEY=…` en Git Bash. La clave no debe aparecer en ningún archivo del repositorio ni en el chat.

## Reglas que se mantienen

- 1080×1920, 30 fps, H.264 + AAC. Portada: elegir un fotograma en Studio y exportarlo con `npx remotion still entre-lineas portada.png --frame=250`.
- Zonas seguras: nada importante por debajo de `y = 1650` (descripción y botones) ni en la franja derecha `x > 950` entre `y = 1100` y `1700` (iconos de TikTok). Las notas a mano van a la izquierda o al centro.
- Ritmo: cortes cada 2-4 s, planos de una frase entre los largos, `LEAD`/`TAIL` bajos y la voz con `style` alto. Un plano nunca espera a su animación: si la voz dura 1,2 s y el mínimo es 1,9, ese 0,7 s tiene que estar ocupado por algo que se mueve.
- Cifras y mecánicas: solo las de `docs/` (`unicoins.md`, `revista-propuestas.md`, `lanzamiento-28-septiembre.md`). Los gags pueden inventar titulares y situaciones, no reglas, fechas ni usuarios reales. Anotar en el `PUBLICAR.md` del día qué es real y qué es chiste.
- Sin fotos de stock generadas: texto, tarjetas, pantallas y la marca. Si hace falta gente, que sea metraje real y con permiso.

## Migración por pasos

1. Crear el proyecto y copiar marca, fuentes y `motion.ts`.
2. Escribir `ui/` con los siete componentes de la lista. Probarlos en una composición de prueba en Studio.
3. Portar `scripts/voz.mjs` desde `render_video.py` (misma caché por hash de frase y ajustes, mismo recorte de silencios).
4. Portar un vídeo ya hecho (el de las ClasiCoins, que tiene la cartera persistente) y comparar con el MP4 existente plano a plano.
5. A partir de ahí, cada vídeo nuevo es un archivo en `videos/` con su array de planos y sus escenas.

Hasta que la migración esté probada, `output/_fuente/render_video.py` sigue siendo el pipeline de producción: los dos generan el mismo formato y pueden convivir.
