"use client";
import { useEffect, useState } from "react";
import { useCommunity } from "./context";

// Se pregunta una vez por visita: la respuesta cambia como mucho cuando se une gente.
let known: boolean | null = null;

/** true o false cuando se sabe; null mientras se pregunta al servidor. En la demo, siempre abiertos. */
export function useMeetGamesOpen(): boolean | null {
 const { demo, repo } = useCommunity();
 const [open, setOpen] = useState<boolean | null>(known);
 useEffect(() => {
  if (demo || known !== null) return;
  let active = true;
  repo.meetGamesOpen().then(value => { known = value; if (active) setOpen(value); }, () => { if (active) setOpen(false); });
  return () => { active = false; };
 }, [demo, repo]);
 return demo ? true : open;
}
