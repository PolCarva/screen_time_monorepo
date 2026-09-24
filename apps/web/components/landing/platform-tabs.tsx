"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import styles from "./how-it-works.module.css";

type Platform = "android" | "ios";

const PlatformContext = createContext<Platform>("android");

/**
 * The Android / iPhone switch. Both versions are in the server HTML; this only
 * decides which one is visible (docs/landing-seo-plan.md, D11).
 */
export function PlatformTabs({
  heading,
  children,
}: {
  heading: ReactNode;
  children: ReactNode;
}) {
  const [platform, setPlatform] = useState<Platform>("android");
  return (
    <PlatformContext.Provider value={platform}>
      <div className={styles.top}>
        {heading}
        <div aria-label="Elegir plataforma" className={styles.tabs} role="group">
          <button
            aria-pressed={platform === "android"}
            className={styles.tab}
            onClick={() => setPlatform("android")}
            type="button"
          >
            Android
          </button>
          <button
            aria-pressed={platform === "ios"}
            className={styles.tab}
            onClick={() => setPlatform("ios")}
            type="button"
          >
            iPhone
          </button>
        </div>
      </div>
      {children}
    </PlatformContext.Provider>
  );
}

export function PlatformPanel({
  platform,
  children,
}: {
  platform: Platform;
  children: ReactNode;
}) {
  const current = useContext(PlatformContext);
  return (
    <div className={styles.panel} data-platform={platform} hidden={current !== platform}>
      {children}
    </div>
  );
}
