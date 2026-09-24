import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export const metadata: Metadata = {
  title: "Soporte",
  description: "Ayuda para configurar Still en Android y iPhone.",
};

const CONTACT_EMAIL = "pablocarvalhogimenez@gmail.com";

const sections = [
  {
    title: "La pausa no aparece en iPhone",
    body: "Still aparece gracias a una automatización personal de la app Atajos: «Cuando se abra [app] → Pausar antes de abrir». Revisa que exista para cada app elegida y que tenga desactivado «Preguntar antes de ejecutar». La app que abriste se ve un instante antes de que llegue Still; así ordena iOS las automatizaciones.",
  },
  {
    title: "La pausa no aparece en Android",
    body: "Still necesita Accesibilidad activada. Abre Still: si falta algún permiso, la app te lleva al ajuste exacto. Algunos fabricantes cierran apps en segundo plano; permite que Still funcione sin restricciones de batería.",
  },
  {
    title: "No hay anuncio disponible",
    body: "Si no hay anuncio ni pase guardado, una pausa breve te deja entrar igual. Nunca quedas bloqueado.",
  },
  {
    title: "Votar en Impacto",
    body: "Para votar, conecta Apple (en iPhone) o Google desde Ajustes. Puedes cambiar tu voto hasta que cierre la semana.",
  },
];

export default function SupportPage() {
  return (
    <>
      <SiteHeader />
      <main id="contenido">
        <article className="legal-page shell-wide">
          <header className="legal-hero">
            <p className="mono-label">SOPORTE / STILL</p>
            <h1>Estamos para ayudarte.</h1>
            <div className="legal-hero__intro">
              <p>
                Respuestas rápidas para configurar Still y un correo para todo
                lo demás.
              </p>
            </div>
          </header>

          <div className="legal-grid">
            {sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </section>
            ))}
          </div>

          <section className="legal-contact">
            <h2>Contacto</h2>
            <div>
              <p>
                Escríbenos a{" "}
                <a className="text-link" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>
                . Respondemos en un plazo de 2 días hábiles.
              </p>
              <Link className="text-link" href="/eliminar-cuenta">
                Eliminar tu cuenta
              </Link>
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
