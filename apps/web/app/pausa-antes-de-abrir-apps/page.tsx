import type { Metadata } from "next";
import Link from "next/link";

import { Article, Note, TableWrap } from "@/components/content/article";
import { CONTENT_PAGES } from "@/lib/content-pages";
import { pageMetadata } from "@/lib/seo";
import { REQUIREMENTS } from "@/lib/site";

const page = CONTENT_PAGES.pausePoint;

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
  ["Google: Pause Point (anuncio, mayo de 2026)", "https://blog.google/products-and-platforms/platforms/android/pause-point/"],
  ["Ayuda de Pixel: Bienestar digital (es-419)", "https://support.google.com/pixelphone/answer/9137850?hl=es-419"],
  ["Infobae: la nueva función de Android contra las apps adictivas (12/5/2026)", "https://www.infobae.com/tecno/2026/05/12/esta-nueva-funcion-de-android-evita-que-pierdas-el-tiempo-en-apps-adictivas/"],
  ["Hipertextual: Android 17 y Pause Point (12/5/2026)", "https://hipertextual.com/mobile/android-17-pause-point-bloqueo-doomscrolling/"],
];

export default function PausePointPage() {
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
          Android 17 trae <strong>Pause Point</strong> («Momento de pausa» en
          español): diez segundos de pausa antes de las apps que marcas como
          distracción. Por ahora solo está en teléfonos Pixel. Si tienes otro
          Android o un iPhone, puedes tener una pausa antes de abrir Instagram o
          TikTok con Still, gratis, en {REQUIREMENTS.android} e{" "}
          {REQUIREMENTS.ios}.
        </p>
      }
      path={page.path}
      published={page.published}
      related={[
        {
          href: "/configurar/android",
          title: "Activar la pausa en Android",
          description: "El permiso de Accesibilidad, paso a paso y por marca.",
        },
        {
          href: "/configurar/iphone",
          title: "Activar la pausa en iPhone",
          description: "La automatización de Atajos que muestra la pausa.",
        },
        {
          href: "/investigacion",
          title: "Qué dice la investigación",
          description: "Por qué una pausa corta cambia cuántas veces abres una app.",
        },
      ]}
      title={page.h1}
      toc={[
        { id: "que-es", label: "Qué es Pause Point" },
        { id: "que-telefonos", label: "En qué teléfonos está" },
        { id: "cualquier-telefono", label: "Una pausa en cualquier teléfono" },
        { id: "diferencias", label: "Pause Point y Still" },
        { id: "por-que-funciona", label: "Por qué funciona una pausa" },
        { id: "fuentes", label: "Fuentes" },
      ]}
      updated={page.updated}
    >
      <h2 id="que-es">Qué es Pause Point</h2>
      <p>
        Google la anunció el 12 de mayo de 2026 junto con Android 17. Cuando
        abres una app que marcaste como distracción, el teléfono te da una
        pausa de diez segundos para preguntarte para qué entras. En esa pausa
        puedes respirar, poner un temporizador, mirar tus fotos o cambiar a
        otra app, como un audiolibro. Está en Configuración → Bienestar digital
        → Formas de desconectarse → Momento de pausa. Según Google, para
        desactivarla hay que reiniciar el teléfono.
      </p>

      <h2 id="que-telefonos">En qué teléfonos está</h2>
      <p>
        Llegó primero a los Pixel 11 con Android 17. Según Xataka Móvil y
        9to5Google, la actualización de septiembre de 2026 la lleva a los
        Pixel 6 y posteriores; la ayuda de Google todavía menciona solo los
        Pixel 11. No encontramos evidencia de que haya llegado a Samsung,
        Xiaomi, Motorola u otras marcas, y no existe en iPhone.
      </p>
      <Note>
        <p>
          Revisamos esta información el 24 de septiembre de 2026. Si Google la
          amplía a más teléfonos, vamos a actualizar esta página.
        </p>
      </Note>

      <h2 id="cualquier-telefono">Una pausa antes de abrir apps en cualquier teléfono</h2>
      <p>
        <Link href="/">Still</Link> hace algo parecido en cualquier Android con{" "}
        {REQUIREMENTS.android} y en iPhone con {REQUIREMENTS.ios}: antes de las
        apps que eliges aparece un segundo de pausa con cuántas veces la
        abriste hoy. Desde ahí vuelves con un toque, o entras por el tiempo que
        elijas; cuando termina, vuelve la pausa.
      </p>
      <ol>
        <li>Instala Still y elige las apps que abres por reflejo.</li>
        <li>
          Actívala: en Android con el{" "}
          <Link href="/configurar/android">permiso de Accesibilidad</Link>; en
          iPhone con una <Link href="/configurar/iphone">automatización de Atajos</Link>.
        </li>
        <li>Abre una de esas apps: primero aparece la pausa.</li>
      </ol>

      <h2 id="diferencias">Pause Point y Still, lado a lado</h2>
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th scope="col"></th>
              <th scope="col">Pause Point (Google)</th>
              <th scope="col">Still</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Teléfonos</th>
              <td>Pixel con Android 17</td>
              <td>Cualquier Android 10+ y iPhone con iOS 16.4+</td>
            </tr>
            <tr>
              <th scope="row">Pausa</th>
              <td>10 segundos, con respiración, temporizador u otras opciones</td>
              <td>1 segundo, con cuántas veces abriste la app hoy</td>
            </tr>
            <tr>
              <th scope="row">Si decides entrar</th>
              <td>Puedes poner un temporizador</td>
              <td>Eliges por cuánto tiempo; después vuelve la pausa</td>
            </tr>
            <tr>
              <th scope="row">Precio</th>
              <td>Incluido en el sistema</td>
              <td>Gratis; anuncio opcional para entrar</td>
            </tr>
            <tr>
              <th scope="row">Qué pasa con el dinero</th>
              <td>No aplica</td>
              <td>El 80 % de los anuncios va a un fondo que la comunidad dona</td>
            </tr>
          </tbody>
        </table>
      </TableWrap>
      <p>
        Si tienes un Pixel compatible, Pause Point es una buena opción y no
        necesitas instalar nada. Still suma que funciona en cualquier teléfono,
        en iPhone también, y que cada vez que entras con un anuncio ayudas a{" "}
        <Link href="/impacto">un proyecto que elige la comunidad</Link>.
      </p>

      <h2 id="por-que-funciona">Por qué funciona una pausa</h2>
      <p>
        La mayoría de las veces que tomas el teléfono no hubo una notificación:
        fue un gesto. En un estudio publicado en PNAS, una pausa con la opción
        de salir redujo 57 % las aperturas de las apps elegidas en seis
        semanas. Ese estudio midió otra app (one sec), no Still ni Pause Point.{" "}
        <Link href="/investigacion">Aquí están los estudios y sus límites</Link>.
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
