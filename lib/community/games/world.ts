import type { Locale } from "@/lib/i18n/routes";
import type { CommunityData, Profile } from "@/lib/community/types";
import type { GameGroup, GamePerson, GameWorld } from "./types";

/**
 * Contacts are implicit, as decided in docs/juegos/00-conceptos-comunes.md:
 * people I already have a private conversation with, or share a small group with.
 */
const smallGroup = 12;

export function buildWorld(data: CommunityData, me: Profile, locale: Locale): GameWorld {
  const t = (es: string, va: string) => locale === "va" ? va : es;
  const groupsOf = (id: string) => data.groupMembers.filter(member => member.user_id === id).map(member => member.group_id);
  const myGroups = new Set(groupsOf(me.user_id));
  const talking = new Set(data.threads.filter(thread => thread.user_a === me.user_id || thread.user_b === me.user_id).map(thread => thread.user_a === me.user_id ? thread.user_b : thread.user_a));
  const size = (groupId: string) => data.groupMembers.filter(member => member.group_id === groupId).length;
  const person = (profile: Profile): GamePerson => {
    const groups = groupsOf(profile.user_id);
    const shared = groups.filter(id => myGroups.has(id) && size(id) <= smallGroup);
    return { id: profile.user_id, name: profile.name, campus: profile.campus, degree: profile.degree, year: profile.year, bio: profile.bio, interests: profile.interests, groups, contact: talking.has(profile.user_id) || shared.length > 0 };
  };
  const groups: GameGroup[] = data.groups.map(group => ({ id: group.id, name: group.name, members: data.groupMembers.filter(member => member.group_id === group.id).map(member => member.user_id) }));
  return { locale, t, me: person(me), people: data.profiles.filter(profile => profile.user_id !== me.user_id).map(person), groups };
}
