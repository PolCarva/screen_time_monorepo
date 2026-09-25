import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/privacy",
  title: "Privacidad: qué datos usa Still y cuáles no | Still",
  description:
    "Qué datos usa Still, cuáles se quedan en tu teléfono y cómo pedir que los borremos. La política de privacidad en lenguaje claro.",
});

const sections = [
  {
    title: "1. Lo que permanece en tu dispositivo",
    body: "La selección de apps, sus nombres, bundle identifiers, package names y el historial detallado de uso permanecen en tu dispositivo. Still no envía esa información a sus servidores, proveedores de analytics ni socios publicitarios.",
  },
  {
    title: "2. Accesibilidad en Android",
    body: "Si activas Accesibilidad, Still recibe eventos de cambio de ventana y el identificador de la app que entra en primer plano para decidir si debe mostrar una pausa en una app que elegiste. También consulta la lista de ventanas abiertas solo para encontrar y cerrar un video flotante (imagen en imagen) que tape esa pausa. No lee, guarda ni envía el texto o el contenido de tu pantalla, no escribe ni realiza otras acciones por ti. Los identificadores elegidos y los contadores por app se procesan localmente y no se recopilan ni comparten. Puedes revocar este acceso en cualquier momento desde los Ajustes de Android.",
  },
  {
    title: "3. Atajos en iOS",
    body: "En iPhone, la pausa funciona con una automatización personal que tú creas en la app Atajos de Apple («Cuando se abra [app] → Pausar [app]»). Still no crea, lee ni modifica tus automatizaciones y no usa Tiempo en pantalla. Los nombres de las apps elegidas se guardan en el almacenamiento compartido de Still dentro del dispositivo y nunca se envían a nuestros servidores. Puedes borrar la automatización en Atajos cuando quieras.",
  },
  {
    title: "4. Datos que procesamos",
    body: "Still puede procesar un identificador anónimo, los datos de una cuenta de Apple o Google si decides vincularla (el identificador de la cuenta y el correo que el proveedor comparta, que en Apple puede ser una dirección privada de reenvío), dispositivos y push tokens registrados, plataforma y país, confirmación de mayoría de edad, eventos del registro de anuncios vistos y entradas, sesiones, votos y conteos diarios agregados. Para proteger los formularios contra abuso, la dirección de red se transforma inmediatamente en una clave HMAC de corta duración; no se guarda la IP en claro. No solicitamos tu fecha de nacimiento.",
  },
  {
    title: "5. Publicidad",
    body: "Para entrar a una app pausada ves un anuncio recompensado; si no hay uno disponible, una pausa de 15 segundos te deja entrar igual. Still usa Google AdMob y Google User Messaging Platform para solicitar consentimiento cuando corresponde. El MVP pide anuncios no personalizados o limitados. Completar un anuncio elegible te deja entrar a la app pausada; no se guarda nada para después. Still guarda cuándo AdMob confirmó cada anuncio y cuánto se estima que generó, para mostrar el fondo semanal en vivo. Still asigna un porcentaje de su ingreso publicitario al fondo; un anuncio individual no dona dinero por sí mismo.",
  },
  {
    title: "6. Analytics y diagnóstico",
    body: "Still puede usar PostHog para analytics de producto y Sentry para diagnóstico de errores. Los eventos pueden incluir plataforma, país, una categoría genérica y conteos agregados. Nunca incluyen el nombre, package name o bundle identifier de una app instalada o elegida, ni el historial detallado de uso.",
  },
  {
    title: "7. Conservación",
    body: "Los agregados de bienestar identificables se conservan hasta 90 días y después pueden mantenerse solo de forma anónima y agregada. Los analytics de producto se conservan hasta 13 meses. Los registros de ingresos, donaciones y auditoría administrativa pueden conservarse siete años o el plazo exigido por la ley aplicable.",
  },
  {
    title: "8. Tus opciones y derechos",
    body: "Puedes rechazar el consentimiento publicitario, entrar después de una pausa breve cuando no haya anuncio disponible, revocar permisos de plataforma, exportar los datos de la cuenta o eliminar la cuenta desde Ajustes → Tus datos en la app. También puedes pedirla sin la app desde la página «Eliminar cuenta» de este sitio. La eliminación borra perfil, dispositivos, agregados, identidades vinculadas y push tokens. Los asientos financieros y el registro de anuncios confirmados pueden conservarse seudonimizados, sin tu identidad, cuando sea legalmente necesario o para que los totales del fondo sigan siendo exactos.",
  },
  {
    title: "9. Procesamiento internacional y seguridad",
    body: "Los proveedores pueden procesar datos en países distintos del tuyo. Still usa controles de acceso, row-level security, transporte cifrado, mutaciones financieras exclusivas del servidor y minimización de datos para proteger la información limitada que procesa.",
  },
  {
    title: "10. Personas adultas y cambios",
    body: "Still está destinado a personas de 18 años o más. Podemos actualizar esta política cuando cambie el producto o las obligaciones legales. Los cambios materiales se comunicarán en la app o en esta página antes de entrar en vigor cuando corresponda.",
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="contenido">
        <article className="legal-page shell-wide">
          <header className="legal-hero">
            <p className="mono-label">PRIVACIDAD / EN LENGUAJE CLARO</p>
            <h1>Tu atención es tuya.</h1>
            <div className="legal-hero__intro">
              <p>
                Esta política explica cómo Still trata la información en la app,
                el fondo público y los servicios administrativos.
              </p>
              <p className="legal-date">
                Actualizada el 25 de septiembre de 2026
              </p>
            </div>
          </header>

          <section className="legal-summary" aria-label="Privacy summary">
            <strong>Promesa directa</strong>
            <p>
              Las apps elegidas y el historial detallado permanecen en el
              dispositivo. Recopilamos solo los datos agregados y operativos
              necesarios para anuncios, sesiones, votos, transparencia, seguridad y
              solicitudes de privacidad.
            </p>
          </section>

          <div className="legal-grid">
            {sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </section>
            ))}
          </div>

          <section className="legal-contact">
            <h2>Preguntas o solicitudes</h2>
            <div>
              <p>
                Usa <strong>Ajustes → Tus datos</strong> en la app para
                exportar o eliminar datos, o sigue los pasos de{" "}
                <Link className="text-link" href="/eliminar-cuenta">
                  eliminar tu cuenta
                </Link>
                . Las consultas también pueden enviarse a{" "}
                <a
                  className="text-link"
                  href="mailto:pablocarvalhogimenez@gmail.com"
                >
                  pablocarvalhogimenez@gmail.com
                </a>
                .
              </p>
              <Link className="text-link" href="/terms">
                Leer los Términos de uso
              </Link>
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
