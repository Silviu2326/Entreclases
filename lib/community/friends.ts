import type { CommunityData, Friendship } from "./types";

/* Cómo estás con alguien: sin nada, amigos, solicitud enviada o solicitud recibida. */
export type FriendState = "none" | "friends" | "sent" | "received";

const between = (friendship: Friendship, a: string, b: string) =>
  (friendship.requester_id === a && friendship.addressee_id === b) || (friendship.requester_id === b && friendship.addressee_id === a);

export function friendState(data: Pick<CommunityData, "friendships">, me: string, other: string): FriendState {
  const row = data.friendships.find(friendship => between(friendship, me, other));
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requester_id === me ? "sent" : "received";
}

/* Los amigos aceptados de `who`, en el orden en que se hicieron amigos, los más recientes primero. */
export function friendIds(data: Pick<CommunityData, "friendships">, who: string): string[] {
  return data.friendships
    .filter(friendship => friendship.status === "accepted" && (friendship.requester_id === who || friendship.addressee_id === who))
    .sort((a, b) => (b.accepted_at ?? b.created_at).localeCompare(a.accepted_at ?? a.created_at))
    .map(friendship => friendship.requester_id === who ? friendship.addressee_id : friendship.requester_id);
}

/* Quién te ha pedido amistad y todavía espera respuesta. */
export const incomingRequests = (data: Pick<CommunityData, "friendships">, me: string) =>
  data.friendships.filter(friendship => friendship.status === "pending" && friendship.addressee_id === me).map(friendship => friendship.requester_id);
