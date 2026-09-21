// Achievements are derived from what the campus already stores: no extra table,
// no server round-trip. Each one counts something the person did and compares it
// with a goal, so the profile can show progress even before it is unlocked.
import type { CopyKey } from "./copy";
import type { CommunityData, Profile } from "./types";

export type AchievementId =
  | "firstPost" | "voice" | "replies" | "likes" | "planner" | "joiner"
  | "groups" | "notes" | "connector" | "coins" | "profile" | "shelf" | "picks";

export type Achievement = {
  id: AchievementId;
  title: CopyKey;
  body: CopyKey;
  goal: number;
  value: number;
  unlocked: boolean;
};

type Definition = Omit<Achievement, "value" | "unlocked"> & { count: (data: CommunityData, me: Profile) => number };

const definitions: Definition[] = [
  { id: "firstPost", title: "achFirstPost", body: "achFirstPostBody", goal: 1, count: (d, me) => d.posts.filter(p => p.author_id === me.user_id).length },
  { id: "voice", title: "achVoice", body: "achVoiceBody", goal: 10, count: (d, me) => d.posts.filter(p => p.author_id === me.user_id).length },
  { id: "replies", title: "achReplies", body: "achRepliesBody", goal: 15, count: (d, me) => d.comments.filter(x => x.author_id === me.user_id).length },
  { id: "likes", title: "achLikes", body: "achLikesBody", goal: 25, count: (d, me) => d.likes.filter(l => l.user_id === me.user_id).length },
  { id: "planner", title: "achPlanner", body: "achPlannerBody", goal: 3, count: (d, me) => d.plans.filter(p => p.creator_id === me.user_id).length },
  { id: "joiner", title: "achJoiner", body: "achJoinerBody", goal: 5, count: (d, me) => d.planMembers.filter(m => m.user_id === me.user_id).length },
  { id: "groups", title: "achGroups", body: "achGroupsBody", goal: 3, count: (d, me) => d.groupMembers.filter(m => m.user_id === me.user_id).length },
  { id: "notes", title: "achNotes", body: "achNotesBody", goal: 3, count: (d, me) => d.notes.filter(n => n.author_id === me.user_id).length },
  { id: "connector", title: "achConnector", body: "achConnectorBody", goal: 5, count: (d, me) => d.threads.filter(t => t.user_a === me.user_id || t.user_b === me.user_id).length },
  { id: "coins", title: "achCoins", body: "achCoinsBody", goal: 100, count: d => d.wallet.balance },
  { id: "shelf", title: "achShelf", body: "achShelfBody", goal: 6, count: (_d, me) => me.favorites.length },
  { id: "picks", title: "achPicks", body: "achPicksBody", goal: 10, count: (_d, me) => me.picks.length },
  { id: "profile", title: "achProfile", body: "achProfileBody", goal: 4, count: (_d, me) => (me.bio.trim() ? 1 : 0) + Math.min(me.interests.length, 3) },
];

export function achievements(data: CommunityData, me: Profile): Achievement[] {
  return definitions
    .map(({ count, ...rest }) => {
      const value = Math.max(0, Math.min(count(data, me), rest.goal));
      return { ...rest, value, unlocked: value >= rest.goal };
    })
    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.value / b.goal - a.value / a.goal);
}

export const unlockedCount = (list: Achievement[]) => list.filter(a => a.unlocked).length;
