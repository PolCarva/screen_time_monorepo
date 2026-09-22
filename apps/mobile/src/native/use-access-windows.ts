import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { type AccessWindow, restrictionEngine } from "@/native/restriction-engine";

/**
 * The access windows running right now, refreshed every second while at least
 * one is open. The deadline itself lives natively — this only reads it, so a
 * window cannot be stretched by keeping Still in the foreground.
 */
export function useAccessWindows(): AccessWindow[] {
  const [windows, setWindows] = useState<AccessWindow[]>([]);

  const read = useCallback(async () => {
    let next: AccessWindow[] = [];
    try {
      // try/catch, not .catch: a native build without this method throws
      // synchronously rather than returning a rejected promise.
      next = await restrictionEngine.getAccessWindows();
    } catch {
      next = [];
    }
    setWindows((current) =>
      current.length === next.length &&
      current.every(
        (entry, index) =>
          entry.endsAt === next[index]?.endsAt &&
          entry.label === next[index]?.label,
      )
        ? current
        : next,
    );
  }, []);

  useEffect(() => {
    void read();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void read();
    });
    return () => subscription.remove();
  }, [read]);

  useEffect(() => {
    if (windows.length === 0) return;
    const timer = setInterval(() => void read(), 1_000);
    return () => clearInterval(timer);
  }, [read, windows.length]);

  return windows;
}

/** Whole seconds left, floored at zero. */
export function secondsLeft(window: AccessWindow, now = Date.now()): number {
  const end = new Date(window.endsAt).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - now) / 1_000));
}
