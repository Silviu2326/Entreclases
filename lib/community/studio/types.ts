export type ProjectSpec = {
  title: string; objective: string; existing: string; contribution: string;
  commitment: string; offer: string; mode: string; roles: string[]; beginners: boolean;
};
export type Project = ProjectSpec & {
  id: string; owner: string; stage: "forming" | "building" | "completed";
  milestones: { title: string; done: boolean }[]; result: string; result_url: string;
  team: { user_id: string; role: string }[]; following: boolean; credits: string[]; created_at: string;
};
export type Application = { id: string; project_id: string; applicant: string; role: string; body: string; availability: string; portfolio: string; status: "pending" | "accepted" | "rejected" };
export type TeamMessage = { id: string; project_id: string; author: string; body: string; created_at: string };
/** A file the team passes around. `path` lives in the private bucket; only the team ever sees it. */
export type ProjectFile = { id: string; project_id: string; author: string; path: string; name: string; note: string; size: number; kind: string; created_at: string };
export type Edition = { id: string; title: string; date: string; published: boolean };
export type SubmissionStatus = "draft" | "pending" | "changes_requested" | "accepted" | "rejected" | "published" | "withdrawn";
export type MagazinePhoto = { path: string; alt: string; caption: string; credit: string };
export type Submission = { id: string; author: string; title: string; body: string; kind: "story" | "project" | "plan" | "post" | "initiative"; source_id: string; source_url: string; attribution: string; consent: boolean; edition_id: string | null; created_at: string;
 status?: SubmissionStatus; summary?: string; section?: string; layout?: "classic" | "photo" | "split"; images?: MagazinePhoto[]; author_note?: string; editorial_note?: string; revision?: number; updated_at?: string;
 history?: { status: SubmissionStatus; at: string; note: string }[];
};
export type StudioData = { magazine_version?: number; projects: Project[]; applications: Application[]; messages: TeamMessage[]; files?: ProjectFile[]; editions: Edition[]; submissions: Submission[]; editor: boolean };
export type StudioInput = Record<string, unknown>;
export const emptyStudio = (): StudioData => ({ projects: [], applications: [], messages: [], files: [], editions: [], submissions: [], editor: false });
export function safeWebUrl(value: string) { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; } }
