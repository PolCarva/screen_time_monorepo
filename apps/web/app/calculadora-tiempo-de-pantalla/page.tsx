import type { Metadata } from "next";
import Link from "next/link";

import { Article, Note, TableWrap } from "@/components/content/article";
import { ScreenTimeCalculator } from "@/components/tools/screen-time-calculator";
import { CONTENT_PAGES } from "@/lib/content-pages";
import { pageMetadata } from "@/lib/seo";

const page = CONTENT_PAGES.calculator;

export const metadata: Metadata = pageMetadata({
  path: page.path,
  title: page.title,
  description: page.description,
  image: `${page.path}/opengraph-image`,
});

const SOURCES = [
  ["DataReportal: Digital 2025 México", "https://datareportal.com/reports/digital-2025-mexico"],
  ["DataReportal: Digital 2025 Argentina", "https://datareportal.com/reports/digital-2025-argentina"],
  ["DataReportal: Digital 2025 Colombia", "https://datareportal.com/reports/digital-2025-colombia"],
  ["DataReportal: Digital 2025 Chile", "https://datareportal.com/reports/digital-2025-chile"],
  ["DataReportal: Digital 2025 Global Overview Report", "https://datareportal.com/reports/digital-2025-global-overview-report"],
];

export default function CalculatorPage() {
  return (
    <Article
      crumbs={[
        { name: "Inicio", path: "/" },
        { name: "Guías", path: "/guias" },
        { name: page.name, path: page.path },
      ]}
      cta={{
        title: "Recupera tu tiempo con una pausa",
        text: "Still aparece un segundo antes de las apps que abres por reflejo. Gratis en iPhone y Android.",
      }}
      description={page.description}
      eyebrow={page.eyebrow}
      lead={
        <p>
          Pon cuántas horas por día pasas en el celular y tu edad: la
          calculadora te muestra cuántos días completos suman por año y cuántos
          años serían de aquí a los 80, y cuánto recuperas con un poco menos por
          día. Todo se calcula en tu navegador; no se guarda ni se envía nada.
        </p>
      }
      path={page.path}
      published={page.published}
      related={[
        {
          href: "/guias/reducir-tiempo-de-pantalla",
          title: "Cómo reducir el tiempo de pantalla",
          description: "Cómo ver tu tiempo real y bajarlo, paso a paso.",
        },
        {
          href: "/guias/usar-menos-el-celular",
          title: "Cómo dejar de usar tanto el celular",
          description: "Cinco cambios concretos, con lo que dicen los estudios.",
        },
        {
          href: "/guias/dejar-de-scrollear",
          title: "Cómo dejar de scrollear",
          description: "Qué ayuda de verdad contra el scroll infinito.",
        },
      ]}
      title={page.h1}
      toc={[
        { id: "calculadora", label: "La calculadora" },
        { id: "como-se-calcula", label: "Cómo se calcula" },
        { id: "tu-tiempo-real", label: "Cómo ver tu tiempo real" },
        { id: "referencias", label: "Cuánto usa la gente el celular" },
        { id: "fuentes", label: "Fuentes" },
      ]}
      updated={page.updated}
    >
      <h2 id="calculadora">La calculadora</h2>
      <ScreenTimeCalculator />

      <h2 id="como-se-calcula">Cómo se calcula</h2>
      <ul>
        <li>
          <strong>Días por año:</strong> horas por día × 365 ÷ 24.
        </li>
        <li>
          <strong>Años hasta los 80:</strong> horas por día × (80 − tu edad) ÷
          24. Los 80 años son una edad de referencia para dimensionar, no una
          predicción.
        </li>
        <li>
          <strong>Lo que recuperas:</strong> el mismo cálculo con los minutos
          que dejarías de usar por día.
        </li>
      </ul>
      <Note>
        <p>
          Es una proyección: supone que tu uso de hoy se mantiene igual, y eso
          casi nunca pasa. Sirve para dimensionar, no para juzgarte.
        </p>
      </Note>

      <h2 id="tu-tiempo-real">Cómo ver tu tiempo real</h2>
      <p>
        En iPhone, en Configuración → Tiempo en pantalla; en Android, en
        Configuración → Bienestar digital. Usa el promedio diario de la última
        semana, no el de un solo día.{" "}
        <Link href="/guias/reducir-tiempo-de-pantalla">Paso a paso para iPhone y Android</Link>.
      </p>

      <h2 id="referencias">Cuánto usa la gente el celular</h2>
      <p>
        Según los informes Digital 2025 de DataReportal (encuesta de GWI de
        fines de 2024, usuarios de internet de 16 años o más), esto es lo que
        se pasa en internet desde el celular por día:
      </p>
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th scope="col">Dónde</th>
              <th scope="col">Por día</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>México</td>
              <td>4 h 20 min</td>
            </tr>
            <tr>
              <td>Argentina</td>
              <td>4 h 40 min</td>
            </tr>
            <tr>
              <td>Colombia</td>
              <td>4 h 47 min</td>
            </tr>
            <tr>
              <td>Chile</td>
              <td>4 h 58 min</td>
            </tr>
            <tr>
              <td>Promedio mundial</td>
              <td>3 h 46 min</td>
            </tr>
          </tbody>
        </table>
      </TableWrap>
      <p>
        Son respuestas de encuesta sobre el tiempo en internet desde el
        celular, no mediciones del tiempo de pantalla de cada teléfono.
      </p>

      <h2 id="fuentes">Fuentes</h2>
      <ul>
        {SOURCES.map(([label, url]) => (
          <li key={url}>
            <a href={url} rel="noopener">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </Article>
  );
}
