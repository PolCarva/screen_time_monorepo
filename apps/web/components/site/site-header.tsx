import Link from "next/link";

import { BrandLockup } from "@/components/brand-mark";

import { HEADER_LINKS } from "./navigation";
import styles from "./site-header.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <div className={`shell ${styles.inner}`}>
        <BrandLockup />
        <nav aria-label="Principal" className={styles.nav}>
          <ul>
            {HEADER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.actions}>
          <Link className={styles.cta} href="/#descargar">
            Descargar<span className={styles.ctaLong}>&nbsp;Still</span>
          </Link>
          {/* A native disclosure: the menu works without JavaScript. */}
          <details className={styles.menu}>
            <summary aria-label="Abrir menú">
              <svg
                aria-hidden="true"
                fill="none"
                height="22"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                width="22"
              >
                <path d="M4 8h16" />
                <path d="M4 16h16" />
              </svg>
            </summary>
            <nav aria-label="Menú" className={styles.menuPanel}>
              <ul>
                {HEADER_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
