import { LandingPage } from "@/components/entreclase/landing-page";
import { PrelaunchPage } from "@/components/entreclase/prelaunch-page";
import { landingMode } from "@/lib/launch/landing-mode";
export default function Home() { return landingMode === "full" ? <LandingPage locale="es" /> : <PrelaunchPage locale="es" />; }
