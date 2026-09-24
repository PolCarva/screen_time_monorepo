import Link from "next/link";
import type { ReactNode } from "react";

import { StoreBadges } from "@/components/landing/store-badges";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { storeNote } from "@/lib/site";
import {
  JsonLd,
  article as articleNode,
  breadcrumbs,
  graph,
  organization,
  type Citation,
  type Crumb,
} from "@/lib/structured-data";

import styles from "./article.module.css";

export type TocItem = { id: string; label: string };
export type RelatedLink = { href: string; title: string; description: string };

const longDate = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatLongDate(isoDate: string): string {
  return longDate.format(new Date(`${isoDate}T00:00:00Z`));
}

type ArticleProps = {
  path: string;
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  /** The direct answer, first thing under the heading. */
  lead: ReactNode;
  description: string;
  published: string;
  updated?: string;
  toc?: TocItem[];
  related?: RelatedLink[];
  citations?: Citation[];
  cta?: { title: string; text: string } | null;
  children: ReactNode;
};

/**
 * The shared layout of guides, setup pages and comparisons
 * (docs/landing-seo-plan.md, D19): breadcrumbs, a dated header, an index,
 * a Still block at the end and related reading.
 */
export function Article({
  path,
  crumbs,
  eyebrow,
  title,
  lead,
  description,
  published,
  updated,
  toc,
  related,
  citations,
  cta = {
    title: "Prueba la pausa de Still",
    text: "Gratis en iPhone y Android. Si vuelves, ganas tiempo; si entras, tu anuncio ayuda a un proyecto que elige la comunidad.",
  },
  children,
}: ArticleProps) {
  const modified = updated ?? published;
  return (
    <>
      <JsonLd
        data={graph(
          organization(),
          articleNode({
            path,
            headline: title,
            description,
            datePublished: published,
            dateModified: modified,
            citations,
          }),
          breadcrumbs(crumbs),
        )}
      />
      <SiteHeader />
      <main className={styles.page} id="contenido">
        <div className="shell">
          <nav aria-label="Migas de pan" className={styles.crumbs}>
            <ol>
              {crumbs.map((crumb, index) => (
                <li key={crumb.path}>
                  {index === crumbs.length - 1 ? (
                    <span aria-current="page">{crumb.name}</span>
                  ) : (
                    <Link href={crumb.path}>{crumb.name}</Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <header className={styles.header}>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className={styles.title}>{title}</h1>
            <div className={styles.lead}>{lead}</div>
            <p className={styles.meta}>
              Actualizado el <time dateTime={modified}>{formatLongDate(modified)}</time>{" "}
              · Equipo de Still
            </p>
          </header>
          <div className={styles.layout}>
            <article className={styles.prose}>
              {children}
              {cta ? (
                <section aria-labelledby="cta-title" className={styles.cta}>
                  <h2 id="cta-title">{cta.title}</h2>
                  <p>{cta.text}</p>
                  <StoreBadges small />
                  <p>{storeNote()}</p>
                </section>
              ) : null}
            </article>
            {toc && toc.length > 0 ? (
              <aside aria-label="En esta página" className={styles.aside}>
                <p className="eyebrow">En esta página</p>
                <ol>
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`}>{item.label}</a>
                    </li>
                  ))}
                </ol>
              </aside>
            ) : null}
          </div>
        </div>
        {related && related.length > 0 ? (
          <section aria-labelledby="related-title" className={styles.related}>
            <div className="shell">
              <p className="eyebrow">Sigue leyendo</p>
              <h2 id="related-title">Guías relacionadas</h2>
              <ul>
                {related.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}

/** A callout inside the text: a limit, a caveat or a tip. */
export function Note({ children }: { children: ReactNode }) {
  return <aside className={styles.note}>{children}</aside>;
}

/** Wide tables scroll sideways on phones instead of breaking the page. */
export function TableWrap({ children }: { children: ReactNode }) {
  return <div className={styles.tableWrap}>{children}</div>;
}
