"use client";

import { useEffect, useState } from "react";

import type { TocItem } from "./article";
import styles from "./article.module.css";

/**
 * The "En esta página" index, marking the section being read. The links work
 * without JavaScript; this only adds the marker.
 */
export function TocSpy({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((heading): heading is HTMLElement => heading !== null);
    if (headings.length === 0) return;

    // The section being read is the last one whose heading has passed the
    // upper third of the screen. Measured per frame on scroll, so it also
    // holds after a jump to an anchor.
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      let current: string | null = null;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > line) break;
        current = heading.id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [items]);

  return (
    <ol>
      {items.map((item) => (
        <li key={item.id}>
          <a
            aria-current={active === item.id ? "location" : undefined}
            className={active === item.id ? styles.tocActive : undefined}
            href={`#${item.id}`}
          >
            {item.label}
          </a>
        </li>
      ))}
    </ol>
  );
}
