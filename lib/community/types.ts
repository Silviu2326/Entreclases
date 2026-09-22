import { emptyWallet, type CoinWallet } from "./unicoins";
import type { Taste } from "./tastes";
import type { FaceKind } from "./images";
import type { ShowcaseAudience, ShowcaseFrame, ShowcaseKind, ShowcaseMediaKind } from "./showcase";
import type { BuiltinSticker, ProfileSpace, StickerPlacement } from "./space";
export type View = "home" | "explore" | "projects" | "magazine" | "plans" | "groups" | "campus" | "people" | "messages" | "mailbox" | "profile" | "unicoins" | "discover";
export const views: View[] = ["home", "explore", "projects", "magazine", "plans", "groups", "campus", "people", "messages", "mailbox", "profile", "unicoins", "discover"];
export const relationshipStatuses = ["single", "in_relationship", "seeing_someone", "complicated", "prefer_not_to_say"] as const;
export type RelationshipStatus = typeof relationshipStatuses[number];
export type Profile = { account_kind?: "university" | "guest"; user_id: string; name: string; university: string; campus: string; degree: string; year: number; bio: string; interests: string[]; color: number; avatar_url?: string; relationship_status?: RelationshipStatus; favorites: Taste[]; picks: string[]; banner_url?: string; showcase_frame?: ShowcaseFrame; space?: unknown; created_at: string };
export type ProfileInput = Pick<Profile, "name" | "campus" | "degree" | "year" | "bio" | "interests" | "color" | "favorites" | "picks"> & { relationship_status: RelationshipStatus };
// The editable half of a profile, for the blocks that save one field at a time.
export const profileInput = (profile: Profile): ProfileInput => ({ name: profile.name, campus: profile.campus, degree: profile.degree, year: profile.year, bio: profile.bio, interests: profile.interests, color: profile.color, favorites: profile.favorites, picks: profile.picks, relationship_status: profile.relationship_status ?? "prefer_not_to_say" });
export type Post = { id: string; author_id: string; body: string; kind: "post" | "question"; group_id: string | null; image_url?: string; created_at: string };
export type Comment = { id: string; post_id: string; author_id: string; body: string; created_at: string };
export type Like = { post_id: string; user_id: string };
/* What someone is going to do about a thread, beyond liking it. */
export type SignalKind = "in" | "same" | "help";
export type Signal = { post_id: string; user_id: string; kind: SignalKind };
export type Group = { id: string; creator_id: string; name: string; description: string; category: string; campus: string; is_private: boolean; share_token?: string; created_at: string };
export type GroupMember = { group_id: string; user_id: string };
export type Plan = { id: string; creator_id: string; title: string; description: string; place: string; meeting_point: string; starts_at: string; capacity: number; created_at: string };
export type PlanMember = { plan_id: string; user_id: string };
export type Note = { id: string; author_id: string; title: string; subject: string; description: string; campus: string; file_name: string; file_path: string; file_size: number; created_at: string };
export type Thread = { id: string; user_a: string; user_b: string; created_at: string };
/* A piece in somebody's showcase. `media_url` is never stored: the repository signs it per read. */
export type ShowcaseItem = { id: string; owner_id: string; kind: ShowcaseKind; title: string; body: string; url?: string | null; media_path?: string | null; media_kind?: ShowcaseMediaKind | null; media_url?: string; audience: ShowcaseAudience; viewers: string[]; position: number; created_at: string };
export type ShowcaseInput = { kind: ShowcaseKind; title: string; body: string; url?: string; audience: ShowcaseAudience; viewers: string[] };
export type ShowcasePatch = Partial<Pick<ShowcaseItem, "title" | "body" | "audience" | "viewers" | "position">>;
/* A sticker on a cover. `url` is never stored: shipped ones resolve to a file of the app, uploaded ones are signed per read. */
export type Sticker = StickerPlacement & { id: string; owner_id: string; path: string; url?: string; created_at: string };
/* `media_url` is never stored: the repository fills it with a short-lived signed link. */
export type Message = { id: string; thread_id: string; sender_id: string; body: string; media_path?: string | null; media_kind?: "image" | "video" | null; media_url?: string; created_at: string };
export type CommunityData = { wallet: CoinWallet; profiles: Profile[]; posts: Post[]; comments: Comment[]; likes: Like[]; signals: Signal[]; groups: Group[]; groupMembers: GroupMember[]; plans: Plan[]; planMembers: PlanMember[]; notes: Note[]; threads: Thread[]; showcase: ShowcaseItem[]; stickers: Sticker[] };
export const emptyCommunity = (): CommunityData => ({ wallet: emptyWallet(), profiles: [], posts: [], comments: [], likes: [], signals: [], groups: [], groupMembers: [], plans: [], planMembers: [], notes: [], threads: [], showcase: [], stickers: [] });
export type PlanInput = Pick<Plan, "title" | "description" | "place" | "meeting_point" | "starts_at" | "capacity">;
export type GroupInput = Pick<Group, "name" | "description" | "category" | "campus" | "is_private">;
export type NoteInput = Pick<Note, "title" | "subject" | "description" | "campus">;
export interface CommunityRepository {
  read(sharedGroupToken?: string): Promise<CommunityData>;
  saveProfile(input: ProfileInput): Promise<Profile>;
  saveFace(kind: FaceKind, image: Blob | null): Promise<Profile>;
  publish(body: string, kind: Post["kind"], groupId: string | null, requestId?: string): Promise<void>;
  removePost(id: string): Promise<void>;
  like(postId: string, on: boolean): Promise<void>;
  signal(postId: string, kind: SignalKind, on: boolean): Promise<void>;
  comment(postId: string, body: string): Promise<void>;
  createPlan(input: PlanInput, requestId?: string): Promise<void>;
  joinPlan(id: string, join: boolean): Promise<void>;
  removePlan(id: string): Promise<void>;
  createGroup(input: GroupInput): Promise<void>;
  joinGroup(id: string, join: boolean, shareToken?: string): Promise<void>;
  uploadNote(input: NoteInput, file: File): Promise<void>;
  downloadNote(note: Note): Promise<string>;
  removeNote(note: Note): Promise<void>;
  openThread(peerId: string): Promise<string>;
  messages(threadId: string): Promise<Message[]>;
  sendMessage(threadId: string, body: string, file?: File): Promise<void>;
  saveShowcaseFrame(frame: ShowcaseFrame): Promise<Profile>;
  addShowcaseItem(input: ShowcaseInput, file?: File): Promise<ShowcaseItem>;
  updateShowcaseItem(id: string, patch: ShowcasePatch): Promise<ShowcaseItem>;
  removeShowcaseItem(item: ShowcaseItem): Promise<void>;
  openShowcaseFile(item: ShowcaseItem): Promise<string>;
  saveSpace(space: ProfileSpace): Promise<Profile>;
  addSticker(source: Blob | BuiltinSticker, placement: StickerPlacement): Promise<Sticker>;
  moveSticker(id: string, placement: StickerPlacement): Promise<Sticker>;
  removeSticker(sticker: Sticker): Promise<void>;
  dispose(): void;
}
export const campuses = ["Tarongers", "Blasco Ibáñez", "Vera", "Burjassot-Paterna", "Otra sede en Valencia"] as const;
/* Los lugares viven en ./places: el mapa de Inicio y el filtro de Explorar leen la misma lista. */
export { places } from "./places";
export const interests = ["Café", "Música", "Deporte", "Cine", "Tecnología", "Arte", "Naturaleza", "Proyectos"] as const;
