"use client";

import { ArrowUpRight, CalendarDays } from "lucide-react";
import { blindRoundLabel, blindRoundTime, blindRoundWeekday, useNow } from "@/lib/community/games/schedule";
import { useCommunity } from "./context";
import { GameLink } from "./games";

// La ronda semanal de La cita empieza hablando, tal como la anuncia Explorar.
export function ExploreWeekly() {
  const { locale } = useCommunity();
  const t = (es: string, va: string) => locale === "va" ? va : es;
  // El relativo ("empieza mañana") se calcula al montar, con la hora del navegador.
  const now = useNow(), language = locale === "va" ? 1 : 0;
  return <section className="ex-weekly" aria-labelledby="ex-weekly-title">
      <div className="ex-weekly-art" aria-hidden="true"><span>?</span><span>!</span><i>hola, ¿y tú?</i></div>
      <div><p className="ex-kicker">{t("UNA CITA CON TIEMPO", "UNA CITA AMB TEMPS")}</p><h2 id="ex-weekly-title">{t("Primero, lo que tienes que contar.", "Primer, el que tens per a contar.")}</h2><p>{t("Los jueves empieza una conversación escrita de 48 horas, sin fotos. Si los dos queréis, después os ponéis cara.", "Els dijous comença una conversa escrita de 48 hores, sense fotos. Si els dos voleu, després vos poseu cara.")}</p><div className="ex-weekly-meta"><span><CalendarDays />{blindRoundWeekday[language]} · {blindRoundTime}</span>{now && <span className="ex-weekly-next">{blindRoundLabel(language, now)}</span>}<span>València · +18</span></div><GameLink id="blind">{t("Así funciona la cita", "Així funciona la cita")}<ArrowUpRight /></GameLink></div>
    </section>;
}
