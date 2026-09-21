"use client";
import { useSyncExternalStore } from "react";
import { authConfigured } from "../auth/config";
import { launchPhase } from "./config";
function subscribe(listener: () => void) {
 const timer = window.setInterval(listener, 1000);
 window.addEventListener("focus", listener);
 document.addEventListener("visibilitychange", listener);
 return () => { window.clearInterval(timer); window.removeEventListener("focus", listener); document.removeEventListener("visibilitychange", listener); };
}
const snapshot = () => Math.floor(Date.now() / 1000) * 1000;
const serverSnapshot = () => null;
export function useLaunch() {
 const now = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
 const ready = authConfigured && process.env.NEXT_PUBLIC_LAUNCH_OPEN === "true";
 return { now, phase: launchPhase(now, ready) };
}
