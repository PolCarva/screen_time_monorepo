import type { Metadata } from "next";
import Link from "next/link";

import { Article, Note, TableWrap } from "@/components/content/article";
import { CONTENT_PAGES } from "@/lib/content-pages";
import { pageMetadata } from "@/lib/seo";

const page = CONTENT_PAGES.oneSec;

export const metadata: Metadata = pageMetadata({
  path: page.path,
  title: page.title,
  description: page.description,
  type: "article",
  publishedTime: page.published,
  modifiedTime: page.updated,
  image: `${page.path}/opengraph-image`,
});

const SOURCES = [
  ["one sec en la App Store (precios de EE. UU.)", "https://apps.apple.com/us/app/id1532875441"],
  ["one sec en Google Play", "https://play.google.com/store/apps/details?id=wtf.riedel.onesec"],
  ["one sec: plataformas", "https://one-sec.app/platforms"],
  ["one sec: preguntas frecuentes", "https://one-sec.app/faq"],
  ["Grüning, Riedel y Lorenz-Spreen (2023), PNAS", "https://doi.org/10.1073/pnas.2213114120"],
];

export default function OneSecAlternativePage() {
  return (
    <Article
      crumbs={[
        { name: "Inicio", path: "/" },
        { name: "Guías", path: "/guias" },
        { name: page.name, path: page.path },
      ]}
      description={page.description}
      eyebrow={page.eyebrow}
      lead={
        <p>
          one sec y Still hacen lo mismo en lo esencial: ponen una pausa antes
          de las apps que abres por reflejo. La diferencia está en el modelo:
          one sec es gratis para una app y cobra una suscripción por el resto
          (US$19,99 al año en la App Store de EE. UU.); Still es gratis para
          todas tus apps y se financia con anuncios opcionales cuyo ingreso se
          dona en un 80 %. one sec tiene más funciones y estudios propios; Still
          es más simple y está pensada en español desde el principio.
        </p>
      }
      path={page.path}
      published={page.published}
      related={[
        {
          href: "/apps-para-dejar-el-celular",
          title: "Apps para dejar el celular: comparativa 2026",
          description: "Opal, one sec, ScreenZen, Forest y más, lado a lado.",
        },
        {
          href: "/pausa-antes-de-abrir-apps",
          title: "Una pausa antes de abrir apps",
          description: "Pause Point de Android 17 y cómo tenerlo en cualquier teléfono.",
        },
        {
          href: "/investigacion",
          title: "Qué dice la investigación",
          description: "Los estudios de one sec y de otros, con sus límites.",
        },
      ]}
      title={page.h1}
      toc={[
        { id: "que-es", label: "Qué es one sec" },
        { id: "comparacion", label: "one sec y Still, lado a lado" },
        { id: "a-favor-one-sec", label: "Dónde gana one sec" },
        { id: "a-favor-still", label: "Dónde gana Still" },
        { id: "cual-elegir", label: "Cuál elegir" },
        { id: "fuentes", label: "Fuentes" },
      ]}
      updated={page.updated}
    >
      <h2 id="que-es">Qué es one sec</h2>
      <p>
        one sec es una app que, antes de abrir una app elegida, muestra
        un mensaje, una espera corta (por ejemplo, un ejercicio de respiración)
        y la opción de no entrar. Está en iPhone, iPad, Mac y Android, y tiene
        extensiones para Chrome, Firefox, Safari y Edge. Su app está disponible
        en español. Un estudio publicado en PNAS en 2023, con su creador entre
        los autores, midió que las aperturas de las apps elegidas bajaron 57 %
        en seis semanas.
      </p>

      <h2 id="comparacion">one sec y Still, lado a lado</h2>
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col">one sec</th>
              <th scope="col">Still</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Precio</th>
              <td>
                Gratis para 1 app. Pro: US$6,99 al mes, US$19,99 al año o
                US$99,99 de por vida
              </td>
              <td>Gratis para todas tus apps</td>
            </tr>
            <tr>
              <th scope="row">Cómo se financia</th>
              <td>Suscripción</td>
              <td>Anuncios opcionales al entrar; el 80 % se dona</td>
            </tr>
            <tr>
              <th scope="row">La pausa</th>
              <td>Respiración, seguir un punto o pantalla negra; duración ajustable</td>
              <td>Un segundo, con cuántas veces abriste la app hoy</td>
            </tr>
            <tr>
              <th scope="row">Si decides entrar</th>
              <td>Entras a la app</td>
              <td>Eliges por cuánto tiempo; después vuelve la pausa</td>
            </tr>
            <tr>
              <th scope="row">Dispositivos</th>
              <td>iPhone, iPad, Mac, Android y navegador</td>
              <td>iPhone y Android</td>
            </tr>
            <tr>
              <th scope="row">Android</th>
              <td>Sí, sin algunas funciones de iOS</td>
              <td>Sí, las mismas funciones que en iPhone</td>
            </tr>
            <tr>
              <th scope="row">Bloquear sitios web</th>
              <td>Sí (Pro)</td>
              <td>No</td>
            </tr>
            <tr>
              <th scope="row">Estudios propios</th>
              <td>Sí (PNAS 2023, CHI 2024)</td>
              <td>Todavía no</td>
            </tr>
          </tbody>
        </table>
      </TableWrap>
      <p>
        Precios de la App Store de EE. UU., revisados el 24 de septiembre de
        2026. En otros países pueden cambiar.
      </p>

      <h2 id="a-favor-one-sec">Dónde gana one sec</h2>
      <ul>
        <li>Más tipos de pausa y más ajustes.</li>
        <li>Funciona en Mac y en el navegador, y bloquea sitios web.</li>
        <li>Tiene estudios revisados por pares sobre su efecto.</li>
        <li>Lleva años en el mercado y tiene muchas reseñas.</li>
      </ul>

      <h2 id="a-favor-still">Dónde gana Still</h2>
      <ul>
        <li>Es gratis para todas tus apps, sin suscripción.</li>
        <li>
          Si decides entrar, eliges por cuánto tiempo y la pausa vuelve sola al
          terminar.
        </li>
        <li>
          Cuando entras con un anuncio, el 80 % de lo que genera va a un{" "}
          <Link href="/impacto">fondo semanal</Link> que la comunidad vota, con
          comprobante público.
        </li>
        <li>Sin rachas ni puntajes: un registro de tu día, no una nota.</li>
        <li>Pensada en español, con guías para iPhone y Android.</li>
      </ul>
      <Note>
        <p>
          Still no tiene relación con one sec. Mencionamos a one sec solo para
          comparar; sus datos vienen de sus propias páginas y fichas en las
          tiendas.
        </p>
      </Note>

      <h2 id="cual-elegir">Cuál elegir</h2>
      <p>
        Si necesitas bloquear sitios web o usarlo en la computadora, one sec es
        más completa. Si quieres una pausa simple en el celular, gratis para
        todas tus apps y que además ayude a un proyecto cada semana, prueba
        Still: se configura en dos minutos en{" "}
        <Link href="/configurar/iphone">iPhone</Link> o{" "}
        <Link href="/configurar/android">Android</Link>.
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
