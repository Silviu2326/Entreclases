"use client";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { readPendingWarmups, reviewWarmup, type PendingWarmup } from "@/lib/backoffice/client";

const gameNames: Record<string, string> = { truth: "Dos verdades y una trola", questions: "Sin dar la cara", blind: "La cita empieza hablando", debate: "Defiende lo indefendible", jury: "El jurado del campus" };
const sample: PendingWarmup[] = [
  { id: "demo-1", game: "debate", model: "gpt-6-luna", created_at: "2026-09-27T09:00:00Z", content: { title: ["Madrugar para ir a clase a las 8 es un privilegio.", "Matinar per a anar a classe a les 8 és un privilegi."], results: [["Valiente. Ahora convence a alguien a las 7:45.", "Valent. Ara convenç algú a les 7:45."], ["Lo sabíamos. Nadie defiende las 8.", "Ho sabíem. Ningú defén les 8."]] } },
  { id: "demo-2", game: "truth", model: "gpt-6-luna", created_at: "2026-09-27T09:00:00Z", content: { options: [["He estudiado en el 81 de ida y vuelta.", "He estudiat en el 81 d’anada i tornada."], ["Me sé el horario de la cafetería de memoria.", "Em sé l’horari de la cafeteria de memòria."], ["Nunca he pedido apuntes prestados.", "Mai he demanat apunts prestats."]], results: [["Verdad. La trola era lo de los apuntes.", "Veritat. La mentida era això dels apunts."], ["Verdad. La trola era lo de los apuntes.", "Veritat. La mentida era això dels apunts."], ["Pillada. Todos hemos pedido apuntes.", "Enxampada. Tots hem demanat apunts."]] } },
];

function loadError(problem: unknown) {
  const raw = problem && typeof problem === "object" ? problem as { code?: string; message?: string } : {};
  if (/ACCESS_REQUIRED/.test(raw.message ?? "")) return "Tu rol no puede revisar rondas.";
  if (["PGRST202", "42883"].includes(raw.code ?? "")) return "Falta aplicar la migración 202609270032_warmups.sql.";
  return "No se han podido cargar las rondas.";
}

// Las rondas que propone la IA no se ven en la aplicación hasta que alguien las aprueba aquí.
export function WarmupsPanel({ demoMode }: { demoMode: boolean }) {
  const [items, setItems] = useState<PendingWarmup[] | null>(demoMode ? sample : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (demoMode) return;
    let active = true;
    readPendingWarmups().then(found => { if (active) setItems(found); }, problem => { if (active) { setItems([]); setError(loadError(problem)); } });
    return () => { active = false; };
  }, [demoMode]);
  const decide = async (id: string, approve: boolean) => {
    setBusy(id); setError("");
    try { if (!demoMode) await reviewWarmup(id, approve); setItems(current => (current ?? []).filter(item => item.id !== id)); }
    catch { setError("No se ha podido guardar. Inténtalo de nuevo."); }
    finally { setBusy(null); }
  };
  return <section className="bo-detail">
    <div className="bo-detail-intro"><span className="bo-eyebrow">JUEGO DEL DÍA</span><h2>Rondas de calentamiento para revisar.</h2><p>Las propone la IA en castellano y valenciano. Solo las aprobadas aparecen en Inicio y Explorar; si un juego no tiene ninguna, sale la de siempre.</p></div>
    {error && <div className="bo-feedback bo-feedback-error" role="alert">{error}</div>}
    {items === null ? <div className="bo-feedback bo-feedback-loading" role="status"><span className="bo-spinner" />Cargando…</div>
      : items.length === 0 ? <p className="bo-empty">No hay rondas pendientes. La tarea programada propone más cada semana.</p>
      : <div className="bo-list">{items.map(item => <article key={item.id} className="bo-warmup">
        <header><span className="bo-eyebrow">{gameNames[item.game] ?? item.game}</span><small>{item.model ?? ""}</small></header>
        <div className="bo-warmup-langs">{[0, 1].map(language => <div key={language}>
          <strong>{language ? "Valencià" : "Castellano"}</strong>
          {item.content.title && <p className="bo-warmup-title">{item.content.title[language]}</p>}
          {item.content.options
            ? <ol>{item.content.options.map((option, index) => <li key={index}>{option[language]}<small>{item.content.results[index]?.[language]}</small></li>)}</ol>
            : <ul>{item.content.results.map((result, index) => <li key={index}><small>{index ? "Segunda opción" : "Primera opción"}</small>{result[language]}</li>)}</ul>}
        </div>)}</div>
        <div className="bo-warmup-actions"><button disabled={busy === item.id} onClick={() => void decide(item.id, true)}><Check size={15} />Aprobar</button><button disabled={busy === item.id} onClick={() => void decide(item.id, false)}><X size={15} />Descartar</button></div>
      </article>)}</div>}
  </section>;
}
