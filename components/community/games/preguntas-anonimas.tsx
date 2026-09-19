"use client";
import { useState } from "react";
import { Action } from "../controls";
import { GameFrame, Say, useGame, useWords } from "./shared";

export default function PreguntasAnonimas() {
  const g = useGame("questions"), t = useWords();
  const [notice, setNotice] = useState("");
  const own = g.rooms.find(r => r.mine);
  return <GameFrame game={g}>
    <p>{t("Recibe preguntas sin mostrar quién las envió. Solo se publican cuando las respondes. La moderación puede identificar al remitente si denuncias.", "Rep preguntes sense mostrar qui les ha enviades. Només es publiquen quan les respons. La moderació pot identificar el remitent si denuncies.")}</p>
    {notice && <p role="status" className="ec-game-status">{notice}</p>}
    {!own && <Action disabled={g.busy} onClick={() => void g.act("create")}>{t("Abrir mi buzón", "Obrir la meua bústia")}</Action>}
    {g.rooms.map(r => <article key={r.id} className="ec-game-entry"><h4>{r.mine ? t("Tu buzón", "La teua bústia") : r.owner_name}</h4>
      {r.mine ? <div className="ec-game-actions"><Action secondary disabled={g.busy} onClick={() => void g.act("delete", { id: r.id })}>{t("Cerrar y borrar mi buzón", "Tancar i esborrar la meua bústia")}</Action>{g.demo && <Action secondary disabled={g.busy} onClick={() => void g.act("simulate", { id: r.id })}>{t("Demo: recibir una pregunta", "Demo: rebre una pregunta")}</Action>}</div> : <Say label={t("Tu pregunta anónima", "La teua pregunta anònima")} busy={g.busy} onSend={async body => { const ok = await g.act("say", { id: r.id, body }); if (ok) setNotice(t("Pregunta enviada. Aparecerá si la responde.", "Pregunta enviada. Apareixerà si la respon.")); return ok; }}/ >}
      {r.moves.length === 0 && <p className="u-muted">{r.mine ? t("Tu buzón está vacío.", "La teua bústia està buida.") : t("Aún no hay respuestas públicas.", "Encara no hi ha respostes públiques.")}</p>}
      {r.moves.map(m => <div className="ec-game-question" key={m.id}><blockquote>{m.body}</blockquote>{m.reply ? <p><strong>{t("Respuesta: ", "Resposta: ")}</strong>{m.reply}</p> : r.mine && <Say label={t("Responder y publicar", "Respondre i publicar")} busy={g.busy} onSend={body => g.act("answer", { id: r.id, move: m.id, body })}/>}{r.mine && <div className="ec-game-actions">{(["dismiss", "block", "report"] as const).map((cmd, i) => <Action secondary disabled={g.busy} key={cmd} onClick={async () => { if (await g.act(cmd, { id: r.id, move: m.id })) setNotice(cmd === "report" && g.demo ? t("Simulación: pregunta retirada. No se ha enviado ninguna denuncia.", "Simulació: pregunta retirada. Cap denúncia enviada.") : cmd === "report" ? t("Denuncia guardada para revisión. Pregunta retirada.", "Denúncia guardada per a revisió. Pregunta retirada.") : t("Pregunta retirada.", "Pregunta retirada.")); }}>{[t("Descartar", "Descartar"), t("Bloquear remitente", "Bloquejar remitent"), t("Denunciar", "Denunciar")][i]}</Action>)}</div>}</div>)}
    </article>)}
  </GameFrame>;
}
