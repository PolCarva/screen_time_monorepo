import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Condiciones para usar Still, sus pases opcionales y el fondo de impacto.",
};

const sections = [
  {
    title: "1. Alcance y aceptación",
    body: "Estos términos regulan el uso de Still, su sitio público y sus servicios relacionados. Al usar el producto aceptas estas condiciones y la Política de privacidad. Still está destinado exclusivamente a personas de 18 años o más.",
  },
  {
    title: "2. Qué hace Still",
    body: "Still añade una pausa intencional antes de abrir determinadas apps y permite registrar decisiones y conteos agregados de bienestar. No es un servicio médico, terapéutico, financiero ni de control parental, y no promete un resultado concreto sobre salud, productividad o tiempo de uso.",
  },
  {
    title: "3. Cuenta e identidad",
    body: "Puedes usar una sesión anónima y vincular una cuenta Google en los flujos que requieren identidad verificada. Eres responsable de proteger el acceso a tu dispositivo y a esa cuenta. No debes intentar usar identidades ajenas, eludir límites ni alterar registros operativos.",
  },
  {
    title: "4. Permisos y control del dispositivo",
    body: "Las restricciones de Android requieren permisos explícitos del sistema, incluidos Accesibilidad y Acceso al uso. Puedes revocarlos desde los ajustes del dispositivo. Still no garantiza que cada fabricante o versión de Android aplique las restricciones de la misma manera; los accesos de emergencia existen para evitar un bloqueo sin salida.",
  },
  {
    title: "5. Anuncios y pases",
    body: "Los anuncios recompensados son opcionales. Un anuncio elegible puede conceder un pase temporal después de la verificación del proveedor. Los pases son personales, no transferibles, no tienen valor monetario y están sujetos a límites diarios y controles antifraude publicados en la configuración activa del producto.",
  },
  {
    title: "6. Fondo de impacto",
    body: "Still asigna al fondo el porcentaje del ingreso publicitario que muestra la configuración activa. La web distingue las cifras estimadas importadas del proveedor de los importes finalizados después de la conciliación. Un anuncio individual no equivale a una donación individual. Los importes finalizados, organizaciones elegidas y comprobantes se publican cuando el proceso operativo correspondiente queda confirmado.",
  },
  {
    title: "7. Uso aceptable",
    body: "No puedes automatizar recompensas, falsificar callbacks, interferir con el servicio, intentar acceder a cuentas o datos ajenos, explotar fallos, descompilar componentes salvo cuando la ley lo permita, ni usar Still de una manera ilegal o que perjudique a otras personas o proveedores.",
  },
  {
    title: "8. Servicios de terceros",
    body: "Still depende de servicios de plataforma e infraestructura como Android, Google, AdMob y Supabase. Sus términos y disponibilidad también pueden aplicar. No controlamos interrupciones, revisiones o cambios introducidos por esos terceros, aunque diseñamos el producto para fallar de manera segura.",
  },
  {
    title: "9. Beta, disponibilidad y cambios",
    body: "La versión actual es una beta cerrada para Android. Podemos corregir, modificar, suspender o retirar funciones por seguridad, cumplimiento o mantenimiento. Los cambios materiales a estos términos se comunicarán en la app o en el sitio antes de entrar en vigor cuando corresponda.",
  },
  {
    title: "10. Responsabilidad",
    body: "Still se ofrece con el nivel de cuidado razonable aplicable a una beta. En la máxima medida permitida por la ley, no respondemos por pérdidas indirectas, decisiones tomadas basándose en estimaciones, disponibilidad de apps de terceros o fallos de una plataforma fuera de nuestro control. Nada de esta sección limita derechos irrenunciables del consumidor.",
  },
  {
    title: "11. Terminación y datos",
    body: "Puedes dejar de usar Still, revocar permisos y eliminar tu cuenta desde Privacidad. Podemos limitar el acceso ante fraude, abuso, riesgo de seguridad o incumplimiento de estos términos. La eliminación y la conservación de registros exigidos por ley se rigen por la Política de privacidad.",
  },
  {
    title: "12. Ley aplicable",
    body: "Estos términos se interpretan conforme a la ley que resulte aplicable según tu ubicación y la del operador de Still. Las protecciones obligatorias del consumidor y los mecanismos legales de reclamación no se ven reducidos por estos términos.",
  },
];

export default function TermsPage() {
  return (
    <main>
      <SiteHeader />
      <article className="legal-page shell-wide">
        <header className="legal-hero">
          <p className="mono-label">TÉRMINOS / EN LENGUAJE CLARO</p>
          <h1>Una pausa útil, con reglas claras.</h1>
          <div className="legal-hero__intro">
            <p>
              Estas condiciones explican qué ofrece Still, cómo funcionan los pases y
              qué responsabilidades acompañan el uso de la beta.
            </p>
            <p className="legal-date">Vigentes desde el 31 de agosto de 2026</p>
          </div>
        </header>

        <section className="legal-summary" aria-label="Resumen de los términos">
          <strong>Resumen directo</strong>
          <p>
            Still ayuda a interrumpir aperturas automáticas. Los anuncios son opcionales,
            los pases no son dinero y el fondo se publica con cifras conciliadas y pruebas.
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
          <h2>Privacidad y cierre de cuenta</h2>
          <div>
            <p>
              Usa <strong>Ajustes → Privacidad</strong> en la app para exportar o eliminar
              datos. Consulta la política para conocer qué se conserva y por qué.
            </p>
            <Link className="text-link" href="/privacy">Leer la Política de privacidad</Link>
          </div>
        </section>
      </article>
    </main>
  );
}
