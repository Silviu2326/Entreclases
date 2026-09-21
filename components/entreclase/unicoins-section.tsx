import { Coins, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/routes";
import { unicoinCopy } from "@/lib/i18n/unicoins";
import { COIN_RULES } from "@/lib/community/unicoins";
import { authConfigured } from "@/lib/auth/config";

export function UnicoinsSection({ locale }: { locale: Locale }) {
  const t = unicoinCopy(locale), va = locale === "va";
  return <section id="unicoins" className="landing-unicoins" aria-labelledby="unicoins-title">
    <div className="section-inner">
      <div className="landing-coins-grid">
        <div className="landing-coins-story" data-reveal="rise">
          <p className="eyebrow"><Coins aria-hidden="true" />ClasiCoins · {va ? "La moneda d’Entreclases" : "La moneda de Entreclases"}</p>
          <h2 id="unicoins-title">{va ? "Ací el saldo puja" : "Aquí el saldo sube"}<br /><em>{va ? "quan t’impliques." : "cuando te implicas."}</em></h2>
          <p>{va ? "Paula munta un café a Benimaclet. Tu t’hi apuntes. Algú pregunta pel tema 4. Tu li tires una mà." : "Paula monta un café en Benimaclet. Tú te apuntas. Alguien pregunta por el tema 4. Tú le echas una mano."}</p>
          <p>{va ? "El primer fil és gratuït. Guanya ClasiCoins responent a altres persones i usa-les per a muntar plans. Apuntar-te a un pla no dona monedes." : "El primer hilo es gratuito. Gana ClasiCoins respondiendo a otras personas y úsalas para montar planes. Apuntarte a un plan no da monedas."}</p>
          <div className="landing-coins-purpose"><strong>{t("purpose")}</strong><p>{t("noMoney")}</p></div>
        </div>
        <div className="landing-coins-mechanics" data-reveal="rise" data-reveal-delay="100">
          <div className="landing-coins-welcome"><span>+{COIN_RULES.welcome}</span><div><strong>{va ? "ClasiCoins de benvinguda." : "ClasiCoins de bienvenida."}</strong><p>{t("welcomeHelp")}</p></div><ArrowDownRight aria-hidden="true" /></div>
          <dl className="landing-coins-actions">
            <div><dt>{t("replyThread")}<small>{t("replyHelp")}</small></dt><dd>+{COIN_RULES.replyThread}<span className="sr-only"> ClasiCoins</span></dd></div>
            <div className="spend"><dt>{t("createEvent")}</dt><dd>−{COIN_RULES.createEvent}<span className="sr-only"> ClasiCoins</span></dd></div>
            <div className="spend"><dt>{t("createThread")}<small>{va ? "El primer és gratuït." : "El primero es gratuito."}</small></dt><dd>−{COIN_RULES.createThread}<span className="sr-only"> ClasiCoins</span></dd></div>
          </dl>
          <p className="landing-coins-free">{t("free")}</p>
          <Button asChild className="entreclase-button landing-coins-button"><a href="#entrar">{va ? "Vull les meues primeres ClasiCoins" : "Quiero mis primeras ClasiCoins"}<ArrowUpRight aria-hidden="true" /></a></Button>
          {!authConfigured && <p className="landing-coins-pending">{va ? "Les 20 de benvinguda t’esperen el dia de l’obertura." : "Las 20 de bienvenida te esperan el día de la apertura."}</p>}
        </div>
      </div>
      <details className="landing-coins-details"><summary>{va ? "I per què hi ha límits?" : "¿Y por qué hay límites?"}</summary><p>{va ? "Una recompensa per fil alié, fins a tres al dia. Respondre’t a tu mateix o repetir respostes no dona més monedes." : "Una recompensa por hilo ajeno, hasta tres al día. Responderte a ti mismo o repetir respuestas no da más monedas."}</p><p>{t("dailyHelp")}</p><p>{t("noRefund")}</p></details>
    </div>
  </section>;
}
