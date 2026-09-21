import { CommunityApp } from "@/components/community/community-app";
import { enabledGames, gameBySlug, languageIndex } from "@/lib/community/games/catalog";
import { gameMetadata } from "@/lib/i18n/metadata";
import "@/app/community.css";
import "leaflet/dist/leaflet.css";
type Params = { params: Promise<{ game: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return enabledGames.map(game => ({ game: game.slug[languageIndex("es")] })); }
export async function generateMetadata({ params }: Params) { const game = gameBySlug("es", (await params).game); return game ? gameMetadata("es", true, game.id) : {}; }
export default async function Page({ params }: Params) { const game = gameBySlug("es", (await params).game); return <CommunityApp locale="es" demo game={game?.id ?? null} />; }
