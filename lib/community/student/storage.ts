"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Estado local de las herramientas del estudiante. Vive en el navegador,
// separado por cuenta y por modo (demo o real), y sobrevive a recargas.
// No se sincroniza con Supabase en esta versión: cada herramienta lo dice en pantalla.
const PREFIX = "entreclases:student";

export function storageKey(scope: { demo: boolean; userId: string }, tool: string) {
  return `${PREFIX}:${scope.demo ? "demo" : "real"}:${scope.userId}:${tool}`;
}

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStore<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * useToolStore("grades", initial) → [value, setValue, ready]
 * `ready` es false durante el primer render (aún no se ha leído localStorage),
 * para que la pantalla no muestre el estado vacío un instante.
 */
export function useToolStore<T>(key: string, initial: T): [T, (next: T | ((current: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const initialRef = useRef(initial);
  useEffect(() => {
    setValue(readStore(key, initialRef.current));
    setReady(true);
  }, [key]);
  const update = useCallback((next: T | ((current: T) => T)) => {
    setValue(current => {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      writeStore(key, resolved);
      return resolved;
    });
  }, [key]);
  return [value, update, ready];
}

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));
