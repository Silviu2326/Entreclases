"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, CalendarRange, Calculator, ClipboardCheck, MapPinned, Users } from "lucide-react";
import { languageIndex, toolBySlug, toolGroups, toolPath, type ToolKind } from "@/lib/community/student/catalog";
import { tools } from "./catalog";
import { matches, useCommunity } from "../context";
import "./student.css";

const artwork: Record<ToolKind, typeof Calculator> = { notes: BookOpenCheck, exam: ClipboardCheck, grades: Calculator, calendar: CalendarRange, teamwork: Users, libraries: MapPinned };
const accents: Record<ToolKind, [string, string]> = { notes: ["#6862a6", "#e2e5f5"], exam: ["#6862a6", "#e2e5f5"], grades: ["#a36534", "#f6e9d6"], calendar: ["#2a6f8d", "#dbe9ef"], teamwork: ["#8c527e", "#eae0ed"], libraries: ["#4d8077", "#e0eee6"] };

// La herramienta abierta va en la URL (?view=student&tool=<slug>), para poder
// enlazarla desde fuera y para que atrás/adelante funcionen dentro de la sección.
function useOpenTool() {
  const { locale } = useCommunity();
  const read = () => { if (typeof window === "undefined") return null; const slug = new URLSearchParams(window.location.search).get("tool"); return slug ? toolBySlug(locale, slug)?.id ?? null : null; };
  const [open, setOpen] = useState<ToolKind | null>(null);
  useEffect(() => {
    queueMicrotask(() => setOpen(read()));
    const pop = () => setOpen(read());
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);
  return open;
}

export function StudentHub() {
  const { locale, demo, query } = useCommunity();
  const language = languageIndex(locale);
  const open = useOpenTool();
  const active = open ? tools.find(tool => tool.id === open) : undefined;
  if (active) { const Screen = active.component; return <Screen />; }
  const listed = tools.filter(tool => matches(query, tool.title[language], tool.description[language]));
  return (
    <div className="st-hub">
      <div className="st-hub-head">
        <p>{language ? "Ferramentes que funcionen encara que sigues l’única persona connectada. Cap necessita que hi haja més gent." : "Herramientas que funcionan aunque seas la única persona conectada. Ninguna necesita que haya más gente."}</p>
      </div>
      {toolGroups.map(group => {
        const groupTools = listed.filter(tool => tool.group === group.id);
        if (!groupTools.length) return null;
        return (
          <section key={group.id} className="st-group" aria-labelledby={`st-group-${group.id}`}>
            <div className="st-group-head"><h3 id={`st-group-${group.id}`}>{group.title[language]}</h3><p>{group.description[language]}</p></div>
            <div className="st-cards">
              {groupTools.map(tool => { const Icon = artwork[tool.id]; const [accent, soft] = accents[tool.id]; return (
                <Link key={tool.id} href={toolPath(locale, demo, tool.id)} className="st-card" style={{ "--card-accent": accent, "--card-soft": soft } as React.CSSProperties}>
                  {tool.ai && <span className="st-card-ai">IA</span>}
                  <span className="st-card-art" aria-hidden="true"><Icon /></span>
                  <strong>{tool.title[language]}</strong>
                  <small>{tool.description[language]}</small>
                  <span className="st-card-effort">{tool.effort[language]}</span>
                </Link>
              ); })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
