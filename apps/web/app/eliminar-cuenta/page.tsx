import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Eliminar cuenta",
  description:
    "Cómo eliminar tu cuenta de Still y sus datos, desde la app o sin ella.",
};

const CONTACT_EMAIL = "pablocarvalhogimenez@gmail.com";

const sections = [
  {
    title: "1. Desde la app",
    body: "Abre Still y ve a Ajustes → Privacidad. Toca «Eliminar cuenta y datos» y confirma con «Eliminar definitivamente». La cuenta se borra en ese momento, en Android y en iPhone.",
  },
  {
    title: "2. Sin la app",
    body: `Escribe a ${CONTACT_EMAIL} con el asunto «Eliminar mi cuenta de Still» desde el correo de la cuenta de Apple o Google que vinculaste. La eliminamos en un plazo máximo de 30 días y te confirmamos por correo. Si nunca vinculaste Apple ni Google, la cuenta es anónima y solo se puede identificar desde la app en tu dispositivo: usa la opción de la app antes de desinstalarla.`,
  },
  {
    title: "3. Qué se elimina",
    body: "El perfil, los dispositivos y push tokens registrados, las identidades de Apple o Google vinculadas, los votos, las sesiones y los agregados diarios de bienestar. Las apps que elegiste y su historial nunca salieron de tu dispositivo; se borran al desinstalar Still.",
  },
  {
    title: "4. Qué se conserva",
    body: "Los asientos financieros del fondo y el registro de anuncios confirmados se conservan seudonimizados, sin tu identidad, hasta siete años o el plazo que exija la ley, para que los totales publicados del fondo sigan siendo exactos.",
  },
];

export default function DeleteAccountPage() {
  return (
    <main>
      <SiteHeader />
      <article className="legal-page shell-wide">
        <header className="legal-hero">
          <p className="mono-label">ELIMINAR CUENTA / STILL</p>
          <h1>Tu cuenta, cuando quieras.</h1>
          <div className="legal-hero__intro">
            <p>
              Cómo eliminar tu cuenta de Still (app de Still Screen Time para
              Android y iPhone) y los datos asociados.
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
          <h2>¿Dudas?</h2>
          <div>
            <p>
              Escríbenos a{" "}
              <a className="text-link" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
            <Link className="text-link" href="/privacy">
              Leer la Política de privacidad
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
