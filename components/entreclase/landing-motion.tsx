"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Motion enhances the existing HTML. No content depends on an observer firing,
// and scrolling updates a decorative rail without rerendering the React tree.
export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const page = root.current;
    const rail = progress.current;
    if (!page || !rail) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const targets = Array.from(page.querySelectorAll<HTMLElement>("[data-reveal]"));
    const played = new Set<HTMLElement>();
    const active = new Map<HTMLElement, Animation>();
    let observer: IntersectionObserver | undefined;
    let frame = 0;

    function settle(target: HTMLElement) {
      played.add(target);
      active.get(target)?.cancel();
      active.delete(target);
      observer?.unobserve(target);
    }

    // Do not restart an entrance over content the reader has already reached,
    // including slow hydration, a restored scroll position or an anchor link.
    if (window.scrollY > 50 || performance.now() > 1500) {
      for (const target of targets) {
        const rect = target.getBoundingClientRect();
        if (rect.top < window.innerHeight) settle(target);
      }
    }

    function reveal(target: HTMLElement) {
      if (played.has(target)) return;
      played.add(target);
      observer?.unobserve(target);
      if (target.matches(":focus-within") || typeof target.animate !== "function") return;

      const kind = target.dataset.reveal;
      const delay = Math.min(240, Math.max(0, Number(target.dataset.revealDelay) || 0));
      const distance = window.innerWidth <= 700 ? "14px" : "24px";
      const keyframes: Keyframe[] = kind === "photo"
        ? [{ opacity: 0.5, scale: "1.06" }, { opacity: 1, scale: "1" }]
        : [{ opacity: 0, translate: `0 ${distance}`, scale: kind === "card" ? "0.97" : "1" }, { opacity: 1, translate: "0 0", scale: "1" }];
      const animation = target.animate(keyframes, {
        duration: kind === "photo" ? 1100 : 720,
        delay,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "backwards",
      });
      target.dataset.motionRevealed = "true";
      active.set(target, animation);
      animation.onfinish = () => active.delete(target);
    }

    function showAnchor() {
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      const anchor = id ? document.getElementById(id) : null;
      if (anchor && page?.contains(anchor)) {
        for (const target of targets) if (anchor === target || anchor.contains(target)) settle(target);
      }
    }

    function focusContent(event: FocusEvent) {
      if (!(event.target instanceof Node)) return;
      for (const target of targets) if (target.contains(event.target)) settle(target);
    }

    function paintProgress() {
      frame = 0;
      const distance = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const fraction = distance ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0;
      rail!.style.transform = `scaleX(${fraction})`;
    }

    function scheduleProgress() {
      if (!frame && !preference.matches) frame = window.requestAnimationFrame(paintProgress);
    }

    function configureMotion() {
      observer?.disconnect();
      for (const animation of active.values()) animation.cancel();
      active.clear();
      page!.dataset.motion = preference.matches ? "reduced" : "ready";
      if (preference.matches) return;
      showAnchor();
      if ("IntersectionObserver" in window) {
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) if (entry.isIntersecting) reveal(entry.target as HTMLElement);
        }, { rootMargin: "0px 0px -5% 0px", threshold: 0 });
        for (const target of targets) if (!played.has(target)) observer.observe(target);
      }
      scheduleProgress();
    }

    configureMotion();
    preference.addEventListener("change", configureMotion);
    page.addEventListener("focusin", focusContent);
    window.addEventListener("hashchange", showAnchor);
    window.addEventListener("scroll", scheduleProgress, { passive: true });
    window.addEventListener("resize", scheduleProgress);
    const resize = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleProgress) : null;
    resize?.observe(page);

    return () => {
      observer?.disconnect();
      resize?.disconnect();
      window.cancelAnimationFrame(frame);
      for (const animation of active.values()) animation.cancel();
      preference.removeEventListener("change", configureMotion);
      page.removeEventListener("focusin", focusContent);
      window.removeEventListener("hashchange", showAnchor);
      window.removeEventListener("scroll", scheduleProgress);
      window.removeEventListener("resize", scheduleProgress);
      delete page.dataset.motion;
      for (const target of targets) delete target.dataset.motionRevealed;
    };
  }, []);

  return <div className="entreclase-landing" ref={root}>
    <div className="reading-progress" ref={progress} aria-hidden="true" />
    {children}
  </div>;
}
