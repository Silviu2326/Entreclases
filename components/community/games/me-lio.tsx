"use client";
import { useState } from "react";
import { Action } from "../controls";
import { EmptyGame, GameFrame, useGame, useWords } from "./shared";

export default function MeLio() {
  const g = useGame("crush"), t = useWords();
  const [adult, setAdult] = useState(false);
  const own = g.rooms.find(r => r.mine);
  const choices = [t("Un café", "Un café"), t("Una cita", "Una cita"), t("Me lío", "M'embolique")];
  return <GameFrame game={g}>
    <p>{t("Elige en privado qué te apetecería con alguien. Solo veréis la coincidencia si elegís lo mismo. Puedes salir cuando quieras.", "Tria en privat què t'abelliria amb algú. Només veureu la coincidència si trieu el mateix. Pots eixir quan vulgues.")}</p>
    {!own ? <div className="ec-game-form"><label className="ec-game-check"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)}/>{t("Tengo 18 años o más y quiero aparecer aquí.", "Tinc 18 anys o més i vull aparéixer ací.")}</label><Action disabled={!adult || g.busy} onClick={() => void g.act("create", { adult })}>{t("Participar", "Participar")}</Action></div> : <><p className="ec-game-status">{t("Estás participando. Tus elecciones no se publican.", "Estàs participant. Les teues eleccions no es publiquen.")}</p><Action secondary disabled={g.busy} onClick={() => void g.act("delete", { id: own.id })}>{t("Dejar de participar", "Deixar de participar")}</Action></>}
    {own && g.rooms.filter(r => !r.mine).map(r => <article className="ec-game-entry" key={r.id}><h4>{r.owner_name}</h4><p>{r.body || t("Con ganas de coincidir.", "Amb ganes de coincidir.")}</p><div className="ec-game-actions">{choices.map((s, i) => <Action key={s} secondary={r.my_choice !== i} disabled={g.busy || r.my_choice !== null} onClick={() => void g.act("vote", { id: r.id, choice: i })}>{s}{r.my_choice === i ? " ✓" : ""}</Action>)}</div>{r.matched ? <div className="ec-game-result" role="status"><strong>{t("¡La chispa es mutua!", "La espurna és mútua!")}</strong><p>{choices[r.my_choice!]} · {r.owner_name}</p>{r.peer_id && <Action onClick={() => void g.chat(r.peer_id!)}>{t("Hablar en privado", "Parlar en privat")}</Action>}{g.demo && <p>{t("Coincidencia de ejemplo; no se ha contactado con nadie.", "Coincidència d'exemple; no s'ha contactat amb ningú.")}</p>}</div> : r.my_choice !== null && <p>{t("Elección guardada. Si coincidís, aparecerá aquí.", "Elecció guardada. Si coincidiu, apareixerà ací.")}</p>}{g.demo && r.my_choice !== null && !r.matched && <Action secondary disabled={g.busy} onClick={() => void g.act("simulate", { id: r.id, choice: r.my_choice! })}>{t("Demo: simular interés mutuo", "Demo: simular interés mutu")}</Action>}</article>)}
    {own && g.rooms.length === 1 && <EmptyGame/>}
  </GameFrame>;
}
