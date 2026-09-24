import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="contenido">
        <section className="not-found shell-wide">
          <header>
            <p className="mono-label">ERROR 404</p>
            <h1>Esta página no existe.</h1>
            <p className="not-found__intro">
              Puede que el enlace haya cambiado. Estos caminos sí existen:
            </p>
          </header>
          <ul className="not-found__links">
            <li>
              <Link className="text-link" href="/">
                Inicio: una pausa antes de abrir apps
              </Link>
            </li>
            <li>
              <Link className="text-link" href="/impacto">
                Impacto: el fondo que dona el 80 % de los anuncios
              </Link>
            </li>
            <li>
              <Link className="text-link" href="/configurar/iphone">
                Configurar Still en iPhone
              </Link>
            </li>
            <li>
              <Link className="text-link" href="/configurar/android">
                Configurar Still en Android
              </Link>
            </li>
            <li>
              <Link className="text-link" href="/investigacion">
                Qué dice la investigación
              </Link>
            </li>
            <li>
              <Link className="text-link" href="/soporte">
                Soporte
              </Link>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
