import { Coins, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localPath, type Locale } from "@/lib/i18n/routes";
import { unicoinCopy } from "@/lib/i18n/unicoins";
import { COIN_RULES } from "@/lib/community/unicoins";
import { authConfigured } from "@/lib/auth/config";

export function UnicoinsSection({ locale }: { locale: Locale }) {
  const t = unicoinCopy(locale), va = locale === "va";
  return <section id="unicoins" className="landing-unicoins" aria-labelledby="unicoins-title">
    <div className="section-inner">
      <div className="landing-coins-grid">
        <div className="landing-coins-story" data-reveal="rise">
          <p className="eyebrow"><Coins aria-hidden="true" />ClasiCoins · {va ? "La moneda d’Entreclase" : "La moneda de Entreclase"}</p>
          <h2 id="unicoins-title">{va ? "Ací el saldo puja" : "Aquí el saldo sube"}<br /><em>{va ? "quan t’impliques." : "cuando te implicas."}</em></h2>
          <p>{va ? "Paula munta un café a Benimaclet. Tu t’hi apuntes. Algú pregunta pel tema 4. Tu li tires una mà." : "Paula monta un café en Benimaclet. Tú te apuntas. Alguien pregunta por el tema 4. Tú le echas una mano."}</p>
          <p>{va ? "Així guanyes ClasiCoins. Després les uses per a obrir el teu fil o muntar el pròxim pla. La gent participa. La universitat es mou." : "Así ganas ClasiCoins. Después las usas para abrir tu propio hilo o montar el siguiente plan. La gente participa. La universidad se mueve."}</p>
          <div className="landing-coins-purpose"><strong>{t("purpose")}</strong><p>{t("noMoney")}</p></div>
        </div>
        <div className="landing-coins-mechanics" data-reveal="rise" data-reveal-delay="100">
          <div className="landing-coins-welcome"><span>+{COIN_RULES.welcome}</span><div><strong>{va ? "ClasiCoins de benvinguda." : "ClasiCoins de bienvenida."}</strong><p>{t("welcomeHelp")}</p></div><ArrowDownRight aria-hidden="true" /></div>
          <dl className="landing-coins-actions">
            <div><dt>{t("joinEvent")}<small>{t("eventHelp")}</small></dt><dd>+{COIN_RULES.joinEvent}<span className="sr-only"> ClasiCoins</span></dd></div>
            <div><dt>{t("replyThread")}<small>{t("replyHelp")}</small></dt><dd>+{COIN_RULES.replyThread}<span className="sr-only"> ClasiCoins</span></dd></div>
            <div className="spend"><dt>{t("createEvent")}</dt><dd>−{COIN_RULES.createEvent}<span className="sr-only"> ClasiCoins</span></dd></div>
            <div className="spend"><dt>{t("createThread")}</dt><dd>−{COIN_RULES.createThread}<span className="sr-only"> ClasiCoins</span></dd></div>
          </dl>
          <p className="landing-coins-free">{t("free")}</p>
          <Button asChild className="entreclase-button landing-coins-button"><a href={localPath(locale,"demo")+"?view=unicoins"}>{va ? "Provar les ClasiCoins" : "Probar las ClasiCoins"}<ArrowUpRight aria-hidden="true" /></a></Button>
          {!authConfigured && <p className="landing-coins-pending">{va ? "L’accés real s’està preparant. Pots provar el sistema en la demo." : "El acceso real se está preparando. Puedes probar el sistema en la demo."}</p>}
        </div>
      </div>
      <details className="landing-coins-details"><summary>{va ? "I per què hi ha límits?" : "¿Y por qué hay límites?"}</summary><p>{t("fairHelp")}</p><p>{t("dailyHelp")}</p><p>{t("noRefund")}</p></details>
    </div>
  </section>;
}
