"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

/**
 * One observer for every `[data-reveal]` block on the page: each one rises
 * into place once, the first time it scrolls into view.
 *
 * Nothing is hidden before this runs, so the server HTML (and crawlers, and a
 * failed script) always shows everything. What is already on screen stays as
 * painted; only what is still below the fold waits to animate. With reduced
 * motion, or without IntersectionObserver, everything is simply shown.
 *
 * A masked heading is clipped to nothing until it reveals, and Chrome counts
 * that clip: its intersection ratio stays at 0. It reveals as soon as its top
 * edge enters instead of waiting for 12% of it to show.
 */
const VISIBLE = 0.12;

export function RevealObserver() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-revealed])"),
    );
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      for (const target of targets) target.setAttribute("data-revealed", "");
      return;
    }

    const fold = window.innerHeight;
    const pending = targets.filter((target) => {
      if (target.getBoundingClientRect().top < fold) {
        target.setAttribute("data-revealed", "");
        return false;
      }
      return true;
    });
    document.documentElement.classList.add("motion");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const masked =
            (entry.target as HTMLElement).dataset.reveal === "mask";
          if (!masked && entry.intersectionRatio < VISIBLE) continue;
          entry.target.setAttribute("data-revealed", "");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: [0, VISIBLE] },
    );
    for (const target of pending) observer.observe(target);

    // Tabbing can land in a block that never scrolls far enough in to reveal
    // (a short one near the bottom edge); focus reveals it, and its ring.
    const hidden = "[data-reveal]:not([data-revealed])";
    const reveal = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      let block = event.target.closest(hidden);
      while (block) {
        block.setAttribute("data-revealed", "");
        observer.unobserve(block);
        block = block.parentElement?.closest(hidden) ?? null;
      }
    };
    document.addEventListener("focusin", reveal);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", reveal);
    };
  }, [pathname]);

  return null;
}
