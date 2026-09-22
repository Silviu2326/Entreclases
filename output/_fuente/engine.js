// Motor de los vídeos verticales: cada <section class="scene"> es un plano.
// render_video.py fija window.TIMES = [{start, dur}] con la duración de cada locución.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const p = (t, a, b) => clamp((t - a) / (b - a));
const eOut = (x) => 1 - Math.pow(1 - x, 3);
const eInOut = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eBack = (x) => { const c1 = 1.55, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const lerp = (a, b, x) => a + (b - a) * x;

const scenes = [...document.querySelectorAll(".scene")];

// Parte los titulares en palabras para que suban una a una.
function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const parts = n.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
          const w = document.createElement("span"); w.className = "w";
          const i = document.createElement("i"); i.textContent = part; w.appendChild(i);
          frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
    });
  };
  walk(el);
}
scenes.forEach((s) => s.querySelectorAll(".hl, .words").forEach(splitWords));

window.getVoices = () => scenes.map((s) => s.dataset.voice || "");
window.getMinDurations = () => scenes.map((s) => parseFloat(s.dataset.min || "2.4"));

window.render = function (t) {
  const T = window.TIMES;
  scenes.forEach((s, i) => {
    const { start, dur } = T[i];
    const u = t - start;
    const visible = u >= -0.02 && (i === scenes.length - 1 || t < T[i + 1].start + 0.5);
    s.style.visibility = visible ? "visible" : "hidden";
    s.style.zIndex = 10 + i;
    if (!visible) return;

    // entrada: sube desde abajo con el filo lima (la primera escena ya está)
    const wipe = i === 0 ? 1 : eInOut(p(u, -0.02, 0.4));
    s.style.clipPath = `inset(${(1 - wipe) * 100}% 0 0 0)`;
    const edge = s.querySelector(".edge");
    edge.style.top = `${(1 - wipe) * 1920}px`;
    edge.style.opacity = wipe > 0 && wipe < 1 ? 1 : 0;

    // fondo: acercamiento lento
    s.querySelectorAll(".full, .photo").forEach((ph) => {
      ph.style.transform = `scale(${lerp(1.1, 1.0, eOut(p(u, 0, dur + 0.6)))})`;
    });

    // titulares palabra a palabra, y el marcador lima detrás
    let k = 0;
    s.querySelectorAll(".hl .w > i, .words .w > i").forEach((w) => {
      const a = 0.2 + k * 0.055; k++;
      w.style.transform = `translateY(${(1 - eOut(p(u, a, a + 0.38))) * 112}%)`;
    });
    const markAt = 0.25 + k * 0.055;
    s.querySelectorAll(".mark").forEach((m, j) => m.style.setProperty("--m", eOut(p(u, markAt + j * 0.12, markAt + 0.3 + j * 0.12))));

    // piezas que aparecen: .pop en orden, con data-at opcional (segundos desde el inicio del plano)
    let n = 0;
    s.querySelectorAll(".pop").forEach((el) => {
      const a = el.dataset.at ? parseFloat(el.dataset.at) : markAt + 0.15 + n * 0.22; n++;
      const x = eBack(p(u, a, a + 0.45));
      el.style.opacity = p(u, a, a + 0.12);
      const base = el.dataset.rot ? `rotate(${el.dataset.rot}deg)` : "";
      el.style.transform = `${base} translateY(${(1 - x) * 90}px) scale(${lerp(.94, 1, x)})`;
    });

    // botones que cambian de estado: data-at + data-b
    s.querySelectorAll("[data-b]").forEach((b) => {
      const a = parseFloat(b.dataset.at || "1.8");
      if (!b.dataset.a) b.dataset.a = b.textContent;
      const on = u >= a;
      b.classList.toggle("on", on);
      b.textContent = on ? b.dataset.b : b.dataset.a;
      const pr = p(u, a - 0.05, a + 0.2);
      b.style.transform = `scale(${pr > 0 && pr < 1 ? 1 - Math.sin(pr * Math.PI) * .1 : 1})`;
    });

    // barra de progreso del vídeo
    const bar = s.querySelector(".prog > b");
    if (bar) bar.style.transform = `scaleX(${clamp((t) / window.TOTAL)})`;
  });
};
