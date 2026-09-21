"use client";

import { createTranslator, type Locale } from "@/lib/i18n";

import Image from "next/image";
import { useState } from "react";
import { BadgeCheck, Bell, CalendarDays, Heart, House, MessageCircle, MoreHorizontal, Search, UserRound, UsersRound, ArrowUpRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

function GroupPost({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  return (
    <article className="preview-post group-post">
      <div className="group-thumb" aria-hidden="true" />
      <div className="group-post-body">
        <p className="post-name">{tr("Primero · Tarongers")}{" "}<BadgeCheck className="verified-icon" aria-label={tr("Correo verificado")} /></p>
        <p className="post-meta">{tr("327 miembros · Ejemplo")}</p>
        <p className="group-question">{tr("¿Alguien tiene los apuntes de macro de la semana pasada?")}</p>
      </div>
      <MoreHorizontal className="post-more" aria-hidden="true" />
    </article>
  );
}

export function CampusPreview({ locale = "es" }: { locale?: Locale }) {
  const tr = createTranslator(locale);
  const [liked, setLiked] = useState(false);
  return (
    <figure className="campus-preview" data-reveal="card" aria-label={tr("Vista previa de Entreclases. Las personas y publicaciones son ejemplos.")}>
      <div className="preview-sidebar" aria-hidden="true">
        <span className="wordmark preview-wordmark">entreclases</span>
        <div className="preview-nav">
          <span className="preview-nav-active"><House />{tr("Inicio")}</span>
          <span><CalendarDays />{tr("Planes")}</span>
          <span><UsersRound />{tr("Grupos")}</span>
          <span><MessageCircle />{tr("Charlas")}</span>
          <span><UserRound />{tr("Perfil")}</span>
        </div>
      </div>
      <div className="preview-main">
        <div className="preview-topbar">
          <p>{tr("Tu campus")}</p>
          <div className="preview-utilities" aria-hidden="true"><Search /><Bell /><span className="photo-avatar avatar-three" /></div>
        </div>
        <Tabs defaultValue="feed" className="preview-tabs">
          <TabsList variant="line" className="preview-tabs-list" aria-label={tr("Explorar la vista previa")}>
            <TabsTrigger value="feed">{tr("Para ti")}</TabsTrigger>
            <TabsTrigger value="plans">{tr("Planes")}</TabsTrigger>
            <TabsTrigger value="groups">{tr("Grupos")}</TabsTrigger>
          </TabsList>
          <TabsContent value="feed" className="preview-tab-panel">
            <article className="preview-post feed-post">
              <div className="post-author">
                <span className="photo-avatar avatar-three" aria-hidden="true" />
                <div><p className="post-name">{tr("Lucía Martín")}{" "}<BadgeCheck className="verified-icon" aria-label={tr("Correo verificado")} /></p><p className="post-meta">{tr("hace 2 h · Ejemplo")}</p></div>
                <MoreHorizontal className="post-more" aria-hidden="true" />
              </div>
              <Image src="/images/campus-feed.webp" width={800} height={450} sizes="(max-width: 700px) 85vw, 35vw" alt={tr("Un grupo de estudiantes disfruta de un café en el campus.")} className="post-image" />
              <div className="post-copy">
                <h3>{tr("¿Quién se viene esta tarde?")}</h3>
                <p>{tr("Cerramos los apuntes en Tarongers y nos vamos a la Malvarrosa. ¿Quién trae una toalla de más?")}</p>
                <div className="post-reactions">
                  <Button type="button" variant="ghost" className="reaction-button" aria-label={liked ? tr("Quitar me gusta de la publicación de ejemplo") : tr("Me gusta la publicación de ejemplo")} aria-pressed={liked} onClick={() => setLiked(!liked)}>
                    <Heart data-icon="inline-start" fill={liked ? "currentColor" : "none"} />{liked ? 13 : 12}
                  </Button>
                  <span><MessageCircle aria-hidden="true" />3</span>
                </div>
              </div>
            </article>
            <GroupPost locale={locale} />
          </TabsContent>
          <TabsContent value="plans" className="preview-tab-panel">
            <article className="preview-post preview-plan">
              <Image src="/images/campus-feed.webp" width={800} height={450} alt={tr("La terraza del campus, con estudiantes tomando café.")} className="post-image" />
              <div className="plan-copy">
                <p className="eyebrow">{tr("Hoy · 17:30 · Ejemplo")}</p>
                <h3>{tr("¿Café en Benimaclet?")}</h3>
                <p>{tr("La excusa es el café.")}<br />{tr("Lo bueno es la compañía.")}</p>
                <Button asChild className="entreclase-button event-button"><a href="#entrar">{tr("Me apunto")}{" "}<ArrowUpRight data-icon="inline-end" /></a></Button>
              </div>
            </article>
          </TabsContent>
          <TabsContent value="groups" className="preview-tab-panel">
            <GroupPost locale={locale} />
            <article className="preview-post preview-group-intro">
              <UsersRound aria-hidden="true" strokeWidth={1.6} />
              <h3>{tr("Un grupo para lo tuyo.")}</h3>
              <p>{tr("Para resolver esa duda de clase. Para compartir apuntes. Para encontrar a tu gente.")}</p>
              <Button asChild className="entreclase-button event-button"><a href="#entrar">{tr("Encontrar mi gente")}{" "}<ArrowUpRight data-icon="inline-end" /></a></Button>
            </article>
          </TabsContent>
        </Tabs>
      </div>
      <figcaption className="sr-only">{tr("Demo interactiva con contenido de ejemplo. Cambia entre publicaciones, planes y grupos.")}</figcaption>
    </figure>
  );
}
