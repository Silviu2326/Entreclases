"use client";

import { createTranslator, localHref, type Locale } from "@/lib/i18n";

import { useRef, useState, type KeyboardEvent } from "react";
import { Menu, X } from "lucide-react";
import { useLaunch } from "@/lib/launch/use-launch";
import { Button } from "@/components/ui/button";

const links = [
  { href: "#historia", label: "La historia" },
  { href: "#campus", label: "Tu campus" },
  { href: "#vida", label: "La vida dentro" },
  { href: "#unicoins", label: "ClasiCoins" },
  { href: "#acceso", label: "Quién puede entrar" },
  { href: "#dudas", label: "Las dudas" },
  { href: "/blog/", label: "Blog" },
  { href: "/roadmap/", label: "Roadmap" },
  { href: "/registro/", label: "Crear mi cuenta" },
];

export function MobileNavigation({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  const { phase } = useLaunch();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault(); setOpen(false); trigger.current?.focus();
    }
  }
  return (
    <div className="mobile-navigation" onKeyDown={keyDown}
      onBlur={(event) => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
      <Button ref={trigger} type="button" variant="ghost" size="icon" className="mobile-menu-toggle"
        aria-label={open ? tr("Cerrar navegación") : tr("Abrir navegación")}
        aria-expanded={open} aria-controls="mobile-page-links" onClick={() => setOpen(!open)}>
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </Button>
      <div id="mobile-page-links" className="mobile-page-links" hidden={!open}>
        {links.map((item) => { const link = item.href === "/registro/" && phase !== "open" ? {href:"#entrar", label:"Dejar mi correo"} : item; return <a key={link.href} href={localHref(locale, link.href)} onClick={() => setOpen(false)}>{tr(link.label)}</a>; })}
      </div>
    </div>
  );
}
