import { COIN_RULES, coinDay, type CoinReason, type CoinWallet } from "./unicoins";

export function createDemoWallet(events: string[] = [], threads: string[] = []) {
  const wallet: CoinWallet = {
    balance: COIN_RULES.welcome,
    transactions: [{ id: crypto.randomUUID(), reason: "welcome", delta: COIN_RULES.welcome, balance_after: COIN_RULES.welcome, resource_id: null, label: "", created_at: new Date().toISOString() }],
    claimed_events: [...events], claimed_threads: [...threads],
    today: { events: 0, replies: 0 }, day: coinDay(),
  };
  const resetDay = () => {
    const day = coinDay();
    if (day !== wallet.day) { wallet.day = day; wallet.today = { events: 0, replies: 0 }; }
  };
  function entry(reason: CoinReason, delta: number, resource: string, label: string) {
    wallet.balance += delta;
    wallet.transactions.unshift({ id: crypto.randomUUID(), reason, delta, balance_after: wallet.balance, resource_id: resource, label: label.slice(0, 160), created_at: new Date().toISOString() });
  }
  return {
    snapshot() { resetDay(); return structuredClone({ ...wallet, transactions: wallet.transactions.slice(0, 50) }); },
    spend(reason: "create_event" | "create_thread", resource: string, label: string) {
      const cost = reason === "create_event" ? COIN_RULES.createEvent : COIN_RULES.createThread;
      if (wallet.transactions.some(t => t.reason === reason && t.resource_id === resource)) throw { message: "UNICOINS_REQUEST_USED" };
      if (wallet.balance < cost) throw { message: "UNICOINS_INSUFFICIENT" };
      entry(reason, -cost, resource, label);
    },
    reward(reason: "join_event" | "reply_thread", resource: string, label: string) {
      resetDay();
      const claims = reason === "join_event" ? wallet.claimed_events : wallet.claimed_threads;
      if (claims.includes(resource)) return;
      claims.push(resource);
      const key = reason === "join_event" ? "events" : "replies";
      const cap = reason === "join_event" ? COIN_RULES.eventRewardsPerDay : COIN_RULES.threadRewardsPerDay;
      if (wallet.today[key] >= cap) return;
      wallet.today[key] += 1;
      entry(reason, reason === "join_event" ? COIN_RULES.joinEvent : COIN_RULES.replyThread, resource, label);
    },
  };
}
