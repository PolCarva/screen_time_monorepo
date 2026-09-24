import Image from "next/image";

import { STORES } from "@/lib/site";

import styles from "./store-badges.module.css";

/**
 * The official store badges (Apple Marketing Tools, es-MX; Google Play badge
 * generator, es-419, with its transparent margin cropped so both badges share
 * the same visible height). D2.
 */
export function StoreBadges({ small = false }: { small?: boolean }) {
  return (
    <ul
      aria-label="Descargar Still"
      className={`${styles.badges}${small ? ` ${styles.small}` : ""}`}
    >
      <li>
        <a className={styles.badge} href={STORES.ios.url}>
          <Image
            alt="Descárgalo en el App Store"
            height={40}
            src="/badges/app-store-es.svg"
            unoptimized
            width={120}
          />
        </a>
      </li>
      <li>
        <a className={styles.badge} href={STORES.android.url}>
          <Image
            alt="Descargar en Google Play"
            height={192}
            src="/badges/google-play-es.png"
            unoptimized
            width={646}
          />
        </a>
      </li>
    </ul>
  );
}
