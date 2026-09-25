"use client";
import { useCallback, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { languageIndex, toolById, toolPath, type ToolKind } from "@/lib/community/student/catalog";
import { storageKey } from "@/lib/community/student/storage";
import { useCommunity } from "../context";
import "./student.css";

/** Lo que recibe cada herramienta: idioma, modo, quién soy y la clave de su almacén local. */
export function useTool(id: ToolKind) {
  const { locale, demo, me } = useCommunity();
  const t = useCallback((es: string, va: string) => locale === "va" ? va : es, [locale]);
  const entry = toolById(id)!;
  const key = useMemo(() => storageKey({ demo, userId: me.user_id }, id), [demo, me.user_id, id]);
  return { locale, demo, me, t, entry, key, language: languageIndex(locale) };
}

/** Marco común: cabecera con vuelta al hub, y el aviso de que el estado vive en este navegador. */
export function ToolShell({ id, children, aside, local = true }: { id: ToolKind; children: ReactNode; aside?: ReactNode; local?: boolean }) {
  const { locale, demo, t, entry, language } = useTool(id);
  return (
    <div className={`st-shell st-shell-${id}`}>
      <div className="st-head">
        <div>
          <Link className="st-back" href={toolPath(locale, demo)}><ArrowLeft aria-hidden="true" />{t("Todas las herramientas", "Totes les ferramentes")}</Link>
          <h2>{entry.title[language]}</h2>
          <p>{entry.description[language]}</p>
        </div>
        {aside}
      </div>
      {children}
      {local && <p className="st-local-note">{t("Lo que guardes aquí se queda en este navegador. Cambiar de dispositivo lo empieza de cero.", "El que guardes ací es queda en este navegador. Canviar de dispositiu ho comença de zero.")}</p>}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`st-panel ${className}`}>{title && <h3>{title}</h3>}{children}</section>;
}

export function Stat({ label, value, tone = "plain" }: { label: string; value: ReactNode; tone?: "plain" | "good" | "warn" | "bad" }) {
  return <div className={`st-stat st-stat-${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "error" }) {
  return <p className={`st-notice st-notice-${tone}`} role={tone === "error" ? "alert" : undefined}>{children}</p>;
}
