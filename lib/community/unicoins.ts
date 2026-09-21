// Product rules for this first version. PostgreSQL enforces the same contract;
// the browser only explains it and previews eligibility.
export const COIN_RULES = {
  welcome: 20,
  createEvent: 10,
  createThread: 5,
  joinEvent: 3,
  replyThread: 2,
  eventRewardsPerDay: 2,
  threadRewardsPerDay: 3,
} as const;
// Joining the list before the opening. PostgreSQL grants it inside the welcome
// entry (migration 023); the landing only announces the number.
export const EARLY_COINS = 30;
export const WELCOME_COINS = COIN_RULES.welcome;
export type CoinReason = "welcome" | "create_event" | "create_thread" | "join_event" | "reply_thread";
export type CoinTransaction = {
  id: string;
  reason: CoinReason;
  delta: number;
  balance_after: number;
  resource_id: string | null;
  label: string;
  created_at: string;
};
export type CoinWallet = {
  balance: number;
  first_thread_available?: boolean;
  event_rewards_enabled?: boolean;
  transactions: CoinTransaction[];
  claimed_events: string[];
  claimed_threads: string[];
  today: { events: number; replies: number };
  day: string;
};
export function coinDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export function emptyWallet(): CoinWallet {
  return { balance: 0, transactions: [], claimed_events: [], claimed_threads: [], today: { events: 0, replies: 0 }, day: coinDay() };
}
export function rewardsToday(wallet: CoinWallet) {
  return wallet.day === coinDay() ? wallet.today : { events: 0, replies: 0 };
}

export function threadCost(wallet: CoinWallet) { return wallet.first_thread_available ? 0 : COIN_RULES.createThread; }
