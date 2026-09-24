import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { CONTENT_PAGES, type ContentPage } from "@/lib/content-pages";
import { pageMetadata } from "@/lib/seo";
import {
  JsonLd,
  breadcrumbs,
  graph,
  itemList,
  organization,
} from "@/lib/structured-data";

import styles from "./guides.module.css";

const page = CONTENT_PAGES.guides;

export const metadata: Metadata = pageMetadata({
  path: page.path,
  title: page.title,
  description: page.description,
  image: "/guias/opengraph-image",
});

const GROUPS: { title: string; pages: ContentPage[] }[] = [
  {
    title: "Usar menos el celular",
    pages: [
      CONTENT_PAGES.lessPhone,
      CONTENT_PAGES.screenTime,
      CONTENT_PAGES.scrolling,
      CONTENT_PAGES.instagram,
      CONTENT_PAGES.tiktok,
      CONTENT_PAGES.pausePoint,
    ],
  },
  {
    title: "Comparar apps",
    pages: [CONTENT_PAGES.compare, CONTENT_PAGES.oneSec],
  },
  {
    title: "Configurar Still",
    pages: [CONTENT_PAGES.iphone, CONTENT_PAGES.android, CONTENT_PAGES.research],
  },
];

export default function GuidesPage() {
  const all = GROUPS.flatMap((group) => group.pages);
  return (
    <>
      <JsonLd
        data={graph(
          organization(),
          breadcrumbs([
            { name: "Inicio", path: "/" },
            { name: page.name, path: page.path },
          ]),
          itemList(
            page.h1,
            all.map((item) => ({ name: item.h1, path: item.path })),
          ),
        )}
      />
      <SiteHeader />
      <main className={styles.page} id="contenido">
        <div className="shell">
          <nav aria-label="Migas de pan" className={styles.crumbs}>
            <ol>
              <li>
                <Link href="/">Inicio</Link>
              </li>
              <li>
                <span aria-current="page">Guías</span>
              </li>
            </ol>
          </nav>
          <header className={styles.header}>
            <p className="eyebrow">{page.eyebrow}</p>
            <h1 className={styles.title}>{page.h1}</h1>
            <p className="lead">
              Sin culpa y sin rachas: ajustes concretos de iPhone y Android,
              qué dice la investigación y cómo se comparan las apps que
              existen. Cada guía dice cuándo se actualizó y de dónde salen sus
              datos.
            </p>
          </header>
          {GROUPS.map((group) => (
            <section aria-labelledby={`grupo-${group.title}`} className={styles.group} key={group.title}>
              <h2 id={`grupo-${group.title}`}>{group.title}</h2>
              <ul className={styles.grid}>
                {group.pages.map((item) => (
                  <li className="reveal" key={item.path}>
                    <Link className={styles.card} href={item.path}>
                      <span className="eyebrow">{item.eyebrow}</span>
                      <strong>{item.h1}</strong>
                      <span>{item.teaser}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
