import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/terms",
  title: "Términos de uso | Still",
  description:
    "Condiciones para usar Still: la pausa, cómo se entra con un anuncio, el fondo de impacto y tu cuenta.",
});

const CONTACT_EMAIL = "pablocarvalhogimenez@gmail.com";
const APPLE_EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

type Section = {
  title: string;
  body: string;
  link?: { href: string; label: string };
};

const sections: Section[] = [
  {
    title: "1. Alcance y aceptación",
    body: "Estos términos regulan el uso de la app Still en Android e iPhone, de este sitio y de sus servicios relacionados. Al configurar o usar Still aceptas estos términos y la Política de privacidad; si no estás de acuerdo, no uses Still. Still está destinado exclusivamente a personas de 18 años o más.",
  },
  {
    title: "2. Qué hace Still",
    body: "Still pone una pausa antes de abrir las apps que eliges y te muestra cuántas veces decidiste no entrar y cuánto tiempo estimamos que eso te devolvió. Esas cifras son estimaciones. Still no es un servicio médico, terapéutico, financiero ni de control parental, y no promete un resultado concreto sobre salud, productividad o tiempo de uso.",
  },
  {
    title: "3. Cuenta e identidad",
    body: "Still funciona con una cuenta anónima. Puedes vincular una cuenta de Apple o de Google para votar el destino del fondo y recuperar tu cuenta si cambias de teléfono. Eres responsable de proteger el acceso a tu dispositivo y a esa cuenta. No debes usar identidades ajenas, votar con varias cuentas, eludir límites ni alterar registros.",
  },
  {
    title: "4. Permisos del dispositivo",
    body: "La pausa necesita permisos que tú activas. En Android, Still usa el servicio de Accesibilidad; en iPhone, una automatización personal que creas en la app Atajos de Apple («Cuando se abra [app] → Pausar [app]»). Puedes revocarlos cuando quieras desde los ajustes del teléfono o borrando la automatización. Cada fabricante y versión del sistema puede aplicar la pausa de forma distinta, así que no garantizamos que aparezca siempre igual.",
  },
  {
    title: "5. La pausa y los anuncios",
    body: "Cuando abres una app que elegiste, Still aparece antes. Puedes volver sin entrar, o ver un anuncio recompensado y elegir cuánto tiempo entrar, desde un minuto hasta el resto del día. Si no hay un anuncio disponible, tras una pausa de 15 segundos eliges cuánto tiempo entrar igual, para que nunca quedes sin salida. Entrar nunca cuesta dinero: no hay compras ni pagos. Ver un anuncio no genera saldo ni créditos, no tiene valor monetario, no se acumula para después y está sujeto a la verificación del proveedor de anuncios y a controles antifraude.",
  },
  {
    title: "6. Fondo de impacto",
    body: "Still destina a un fondo semanal el porcentaje de su ingreso publicitario que se muestra en la app y en la página Impacto. Las personas con una cuenta vinculada votan qué organización lo recibe, y Still hace la donación por el canal público de donaciones de esa organización. Las organizaciones no están afiliadas a Still ni lo respaldan. Un anuncio no equivale a una donación. Mostramos por separado las cifras estimadas y las confirmadas tras la conciliación con el proveedor, y publicamos el comprobante de cada donación.",
  },
  {
    title: "7. Uso aceptable",
    body: "No puedes automatizar anuncios o votos, falsificar callbacks, interferir con el servicio, intentar acceder a cuentas o datos ajenos, explotar fallos, descompilar componentes salvo cuando la ley lo permita, ni usar Still de una manera ilegal o que perjudique a otras personas o proveedores.",
  },
  {
    title: "8. Servicios de terceros",
    body: "Still depende de servicios de plataforma e infraestructura como Apple, Google (incluido AdMob), Supabase y Vercel. Sus términos y su disponibilidad también pueden aplicar. No controlamos sus interrupciones, revisiones o cambios, aunque diseñamos Still para que falle de manera segura.",
  },
  {
    title: "9. App Store y Google Play",
    body: "Si descargaste Still desde el App Store, también rige el Contrato de licencia de usuario final estándar de Apple. Apple y Google no son parte de estos términos ni responsables de Still, de su mantenimiento ni de su soporte: las consultas y reclamos sobre Still se dirigen a nosotros.",
    link: {
      href: APPLE_EULA_URL,
      label: "Leer el contrato estándar de Apple",
    },
  },
  {
    title: "10. Disponibilidad y cambios",
    body: "Still se distribuye en Android e iPhone mediante pruebas o como versión pública, según los procesos de revisión de cada tienda. Podemos corregir, modificar, suspender o retirar funciones por seguridad, cumplimiento o mantenimiento. Los cambios materiales a estos términos se comunicarán en la app o en este sitio antes de entrar en vigor cuando corresponda.",
  },
  {
    title: "11. Responsabilidad",
    body: "Still se ofrece con un nivel de cuidado razonable. En la máxima medida permitida por la ley, no respondemos por pérdidas indirectas, decisiones tomadas a partir de estimaciones, la disponibilidad de apps de terceros o fallos de una plataforma fuera de nuestro control. Nada de esta sección limita derechos irrenunciables del consumidor.",
  },
  {
    title: "12. Terminación y datos",
    body: "Puedes dejar de usar Still, revocar permisos y eliminar tu cuenta desde Ajustes → Tus datos en la app. Podemos limitar el acceso ante fraude, abuso, riesgo de seguridad o incumplimiento de estos términos. La eliminación y la conservación de registros exigidos por ley se rigen por la Política de privacidad.",
  },
  {
    title: "13. Ley aplicable",
    body: "Estos términos se interpretan conforme a la ley que resulte aplicable según tu ubicación y la del operador de Still. Las protecciones obligatorias del consumidor y los mecanismos legales de reclamación no se ven reducidos por estos términos.",
  },
];

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main id="contenido">
        <article className="legal-page shell-wide">
          <header className="legal-hero">
            <p className="mono-label">TÉRMINOS / EN LENGUAJE CLARO</p>
            <h1>Una pausa útil, con reglas claras.</h1>
            <div className="legal-hero__intro">
              <p>
                Estas condiciones explican qué ofrece Still, cómo se entra a una
                app pausada, cómo funciona el fondo y qué responsabilidades
                acompañan su uso.
              </p>
              <p className="legal-date">
                Actualizados el 25 de septiembre de 2026
              </p>
            </div>
          </header>

          <section
            className="legal-summary"
            aria-label="Resumen de los términos"
          >
            <strong>Resumen directo</strong>
            <p>
              Still pone una pausa antes de las apps que eliges. Para entrar ves
              un anuncio, o esperas 15 segundos si no hay uno; nunca pagas nada.
              Parte del ingreso va a un fondo semanal que se publica con cifras
              conciliadas y comprobantes.
            </p>
          </section>

          <div className="legal-grid">
            {sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
                {section.link ? (
                  <a className="text-link" href={section.link.href}>
                    {section.link.label}
                  </a>
                ) : null}
              </section>
            ))}
          </div>

          <section className="legal-contact">
            <h2>Preguntas, privacidad y cierre de cuenta</h2>
            <div>
              <p>
                Escribe a{" "}
                <a className="text-link" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>{" "}
                o visita{" "}
                <Link className="text-link" href="/soporte">
                  Soporte
                </Link>
                . Usa <strong>Ajustes → Tus datos</strong> en la app para
                exportar o eliminar datos, o sigue los pasos de{" "}
                <Link className="text-link" href="/eliminar-cuenta">
                  eliminar tu cuenta
                </Link>
                . Consulta la política para conocer qué se conserva y por qué.
              </p>
              <Link className="text-link" href="/privacy">
                Leer la Política de privacidad
              </Link>
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
