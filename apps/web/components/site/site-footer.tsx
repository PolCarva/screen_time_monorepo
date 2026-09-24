import Link from "next/link";

import { BrandLockup } from "@/components/brand-mark";

import { FOOTER_COLUMNS } from "./navigation";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className="shell">
        <div className={styles.grid}>
          <div className={styles.brand}>
            <BrandLockup />
            <p>
              Un segundo antes de entrar. Una pausa para ti que también ayuda
              a otros.
            </p>
          </div>
          {FOOTER_COLUMNS.map((column) => (
            <nav aria-label={column.title} className={styles.column} key={column.title}>
              <p className="eyebrow eyebrow--dark">{column.title}</p>
              <ul>
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    {link.external ? (
                      <a href={link.href}>{link.label}</a>
                    ) : (
                      <Link href={link.href}>{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className={styles.bottom}>
          <span>© 2026 Still · Para personas de 18 años o más</span>
          <span>Los nombres de tus apps nunca salen de tu teléfono.</span>
        </div>
      </div>
    </footer>
  );
}
