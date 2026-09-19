"use client";

import { Coins, ArrowUpRight, CalendarDays, MessageCircle, ArrowDownLeft, ArrowUpRight as SpendIcon, Sparkles } from "lucide-react";
import { COIN_RULES, rewardsToday, type CoinReason } from "@/lib/community/unicoins";
import { unicoinCopy } from "@/lib/i18n/unicoins";
import { formatDate } from "@/lib/community/copy";
import { useCommunity, matches } from "./context";
import { Action, Empty } from "./controls";

export function CoinAmount({ amount, signed = false }: { amount: number; signed?: boolean }) {
  return <span className="u-coin-amount"><Coins aria-hidden="true" />{signed && amount > 0 ? "+" : ""}{amount}<span className="sr-only"> ClasiCoins</span></span>;
}
export function CoinBalance() {
  const { data, locale, go } = useCommunity();
  const t = unicoinCopy(locale);
  return <button className="u-coin-balance" onClick={() => go("unicoins")} aria-label={`${data.wallet.balance} ClasiCoins · ${t("wallet")}`}><CoinAmount amount={data.wallet.balance} /><span className="u-coin-balance-label">ClasiCoins</span></button>;
}
export function SpendNotice({ amount }: { amount: number }) {
  const { data, locale, go } = useCommunity();
  const t = unicoinCopy(locale), enough = data.wallet.balance >= amount;
  return <div className={`u-coin-spend ${enough ? "" : "short"}`}>
    <div><span>{t("cost")}: <CoinAmount amount={amount} /></span><span>{t("available")}: <strong>{data.wallet.balance}</strong></span></div>
    <p>{enough ? t("spendHelp") : t("insufficient")}</p>
    <button type="button" className="u-text-link" onClick={() => go("unicoins")}>{t(enough ? "wallet" : "earnLink")}<ArrowUpRight aria-hidden="true" /></button>
  </div>;
}
export function RewardHint({ kind, resourceId, own, participated = false }: { kind: "event" | "thread"; resourceId: string; own: boolean; participated?: boolean }) {
  const { data, locale, go } = useCommunity();
  const t = unicoinCopy(locale), wallet = data.wallet, today = rewardsToday(wallet);
  const claimed = (kind === "event" ? wallet.claimed_events : wallet.claimed_threads).includes(resourceId) || participated;
  const capped = kind === "event" ? today.events >= COIN_RULES.eventRewardsPerDay : today.replies >= COIN_RULES.threadRewardsPerDay;
  const eligible = !own && !claimed && !capped;
  const description = own ? t(kind === "event" ? "ownEvent" : "ownThread") : claimed ? t(kind === "event" ? "rewardUsed" : "replyUsed") : capped ? t("dailyFull") : t(kind === "event" ? "eventHelp" : "replyHelp");
  return <div className={`u-coin-reward ${eligible ? "eligible" : ""}`}>
    {eligible && <CoinAmount amount={kind === "event" ? COIN_RULES.joinEvent : COIN_RULES.replyThread} signed />}
    <p>{description}</p><button type="button" onClick={() => go("unicoins")} aria-label={t("wallet")}><ArrowUpRight aria-hidden="true" /></button>
  </div>;
}
export function Unicoins() {
  const { data, c, locale, go, query, demo } = useCommunity();
  const t = unicoinCopy(locale), wallet = data.wallet, today = rewardsToday(wallet);
  const labels: Record<CoinReason, string> = { welcome: t("welcome"), create_event: t("createEvent"), create_thread: t("createThread"), join_event: t("joinEvent"), reply_thread: t("replyThread") };
  const transactions = wallet.transactions.filter(tx => matches(query, labels[tx.reason], tx.label));
  return <div className="u-unicoins">
    <section className="u-wallet-intro">
      <div className="u-wallet-balance"><span>{t("balance")}</span><strong key={wallet.balance}><CoinAmount amount={wallet.balance} /></strong><span>ClasiCoins</span></div>
      <div><p className="u-eyebrow">Entreclase · ClasiCoins</p><h2>{t("purpose")}</h2><p>{t("noMoney")}</p></div>
    </section>
    <div className="u-coin-welcome"><Sparkles aria-hidden="true" /><div><strong>{t("start")}</strong><p>{t("welcomeHelp")}</p></div></div>
    <section className="u-coin-rules" aria-label={t("how")}>
      <div className="u-card u-coin-rule"><p className="u-eyebrow">{t("earn")}</p><h2>{t("joinEvent")}</h2><CoinAmount amount={COIN_RULES.joinEvent} signed /><p>{t("eventHelp")}</p><Action secondary onClick={() => go("plans")}>{c("findPlan")}<CalendarDays aria-hidden="true" /></Action></div>
      <div className="u-card u-coin-rule"><p className="u-eyebrow">{t("earn")}</p><h2>{t("replyThread")}</h2><CoinAmount amount={COIN_RULES.replyThread} signed /><p>{t("replyHelp")}</p><Action secondary onClick={() => go("home")}>{c("wall")}<MessageCircle aria-hidden="true" /></Action></div>
      <div className="u-card u-coin-rule spend"><p className="u-eyebrow">{t("spend")}</p><h2>{t("createEvent")}</h2><CoinAmount amount={-COIN_RULES.createEvent} signed /><p>{t("spendHelp")}</p></div>
      <div className="u-card u-coin-rule spend"><p className="u-eyebrow">{t("spend")}</p><h2>{t("createThread")}</h2><CoinAmount amount={-COIN_RULES.createThread} signed /><p>{t("spendHelp")}</p></div>
    </section>
    <section className="u-card u-coin-daily"><div><h2>{t("daily")}</h2><p>{t("dailyHelp")}</p></div><div className="u-coin-quota"><span>{t("eventsToday")}</span><strong>{today.events} / {COIN_RULES.eventRewardsPerDay}</strong><progress value={today.events} max={COIN_RULES.eventRewardsPerDay} aria-label={t("eventsToday")} /></div><div className="u-coin-quota"><span>{t("threadsToday")}</span><strong>{today.replies} / {COIN_RULES.threadRewardsPerDay}</strong><progress value={today.replies} max={COIN_RULES.threadRewardsPerDay} aria-label={t("threadsToday")} /></div></section>
    <section className="u-coin-fair"><h2>{t("fair")}</h2><p>{t("fairHelp")}</p><p>{t("noRefund")}</p><strong>{t("free")}</strong></section>
    <section className="u-card u-coin-history"><header><h2>{t("history")}</h2><p>{t("historyHelp")}</p></header>{transactions.length ? <ul>{transactions.map(tx => <li key={tx.id}><span className={`u-coin-direction ${tx.delta > 0 ? "in" : "out"}`}>{tx.delta > 0 ? <ArrowDownLeft aria-hidden="true" /> : <SpendIcon aria-hidden="true" />}</span><div><strong>{labels[tx.reason]}</strong>{tx.label && <p>{tx.label}</p>}<time dateTime={tx.created_at}>{formatDate(tx.created_at, locale)}</time></div><span className={tx.delta > 0 ? "positive" : "negative"}><CoinAmount amount={tx.delta} signed /></span></li>)}</ul> : <Empty title={query ? c("emptySearch") : t("noHistory")} />}</section>
    {demo && <p className="u-coin-demo-note">{t("accountPending")}</p>}
  </div>;
}
