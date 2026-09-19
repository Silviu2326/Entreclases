export type GameKind = "crush" | "questions" | "debate" | "truth" | "hangout" | "jury" | "blind";
export type Move = { id: string; label: string; body: string; reply: string; choice: number; mine: boolean; kind: string };
export type Room = { id: string; mine: boolean; owner_name: string; body: string; options: string[]; place: string; expires: string | null; count: number; capacity: number; joined: boolean; my_choice: number | null; answer: number | null; matched: boolean; peer_id: string | null; votes: number[]; moves: Move[]; revealed: boolean };
export type Input = { id?: string; body?: string; options?: string[]; choice?: number; place?: string; capacity?: number; minutes?: number; adult?: boolean; move?: string };
