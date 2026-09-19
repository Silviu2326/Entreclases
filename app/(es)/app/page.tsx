import { CommunityApp } from "@/components/community/community-app";
import { pageMetadata } from "@/lib/i18n/metadata";
import "@/app/community.css";
import "leaflet/dist/leaflet.css";
export const metadata=pageMetadata("es","app");
export default function Page(){return <CommunityApp locale="es" />;}
