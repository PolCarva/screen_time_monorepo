import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Cómo Still trata los datos del dispositivo, bienestar, publicidad e impacto.",
};

const sections = [
  {
    title: "1. Lo que permanece en tu dispositivo",
    body: "La selección de apps, sus nombres, bundle identifiers, package names y el historial detallado de Screen Time o Usage Stats permanecen en tu dispositivo. Still no envía esa información a sus servidores, proveedores de analytics ni socios publicitarios.",
  },
  {
    title: "2. Datos que procesamos",
    body: "Still puede procesar un identificador anónimo, datos de una cuenta Google si decides vincularla, dispositivos y push tokens registrados, plataforma y país, confirmación de mayoría de edad, eventos del ledger de pases, sesiones, votos y conteos diarios agregados. Para proteger el formulario de beta contra abuso, la dirección de red se transforma inmediatamente en una clave HMAC de corta duración; no se guarda la IP en claro. No solicitamos tu fecha de nacimiento.",
  },
  {
    title: "3. Publicidad opcional",
    body: "Los anuncios recompensados son opcionales. Still usa Google AdMob y Google User Messaging Platform para solicitar consentimiento cuando corresponde. El MVP pide anuncios no personalizados o limitados. Completar un anuncio elegible concede un pase no transferible. Still asigna un porcentaje de su ingreso publicitario al fondo; un anuncio individual no dona dinero por sí mismo.",
  },
  {
    title: "4. Analytics y diagnóstico",
    body: "Still puede usar PostHog para analytics de producto y Sentry para diagnóstico de errores. Los eventos pueden incluir plataforma, país, una categoría genérica y conteos agregados. Nunca incluyen el nombre, package name o bundle identifier de una app instalada o elegida, ni el historial detallado de uso.",
  },
  {
    title: "5. Conservación",
    body: "Los agregados de bienestar identificables se conservan hasta 90 días y después pueden mantenerse solo de forma anónima y agregada. Los analytics de producto se conservan hasta 13 meses. Los registros de ingresos, donaciones y auditoría administrativa pueden conservarse siete años o el plazo exigido por la ley aplicable.",
  },
  {
    title: "6. Tus opciones y derechos",
    body: "Puedes rechazar el consentimiento publicitario, usar accesos de emergencia cuando no haya anuncios, revocar permisos de plataforma, exportar los datos de la cuenta o solicitar su eliminación desde Privacidad. La eliminación borra perfil, dispositivos, agregados y push tokens. Los asientos financieros pueden conservarse seudonimizados cuando sea legalmente necesario.",
  },
  {
    title: "7. Procesamiento internacional y seguridad",
    body: "Los proveedores pueden procesar datos en países distintos del tuyo. Still usa controles de acceso, row-level security, transporte cifrado, mutaciones financieras exclusivas del servidor y minimización de datos para proteger la información limitada que procesa.",
  },
  {
    title: "8. Personas adultas y cambios",
    body: "Still está destinado a personas de 18 años o más. Podemos actualizar esta política cuando cambie el producto o las obligaciones legales. Los cambios materiales se comunicarán en la app o en esta página antes de entrar en vigor cuando corresponda.",
  },
];

export default function PrivacyPage() {
  return (
    <main>
      <SiteHeader />
      <article className="legal-page shell-wide">
        <header className="legal-hero">
          <p className="mono-label">PRIVACIDAD / EN LENGUAJE CLARO</p>
          <h1>Tu atención es tuya.</h1>
          <div className="legal-hero__intro">
            <p>Esta política explica cómo Still trata la información en la app, el fondo público y los servicios administrativos.</p>
            <p className="legal-date">Vigente desde el 23 de agosto de 2026</p>
          </div>
        </header>

        <section className="legal-summary" aria-label="Privacy summary">
          <strong>Promesa directa</strong>
          <p>
            Las apps elegidas y el historial detallado permanecen en el dispositivo.
            Recopilamos solo los datos agregados y operativos necesarios para pases,
            sesiones, votos, transparencia, seguridad y solicitudes de privacidad.
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
              Usa <strong>Ajustes → Privacidad</strong> en la app para exportar o eliminar datos.
              Hasta que abra la beta, las consultas también pueden enviarse al administrador del proyecto.
            </p>
            <Link className="text-link" href="/">Volver a Still</Link>
          </div>
        </section>
      </article>
    </main>
  );
}
