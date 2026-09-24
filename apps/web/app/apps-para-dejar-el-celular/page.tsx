import type { Metadata } from "next";
import Link from "next/link";

import { Article, Note, TableWrap } from "@/components/content/article";
import { CONTENT_PAGES } from "@/lib/content-pages";
import { pageMetadata } from "@/lib/seo";

const page = CONTENT_PAGES.compare;

export const metadata: Metadata = pageMetadata({
  path: page.path,
  title: page.title,
  description: page.description,
  type: "article",
  publishedTime: page.published,
  modifiedTime: page.updated,
  image: `${page.path}/opengraph-image`,
});

type App = {
  id: string;
  name: string;
  price: string;
  method: string;
  devices: string;
  pros: string[];
  cons: string[];
  source: string;
};

const APPS: App[] = [
  {
    id: "still",
    name: "Still",
    price: "Gratis; anuncio opcional para entrar",
    method: "Pausa de un segundo antes de las apps que eliges",
    devices: "iPhone (iOS 16.4+) y Android 10+",
    pros: [
      "Gratis para todas tus apps",
      "Si entras, eliges por cuánto tiempo",
      "El 80 % del ingreso de los anuncios se dona a un proyecto que vota la comunidad",
    ],
    cons: [
      "No bloquea sitios web ni funciona en la computadora",
      "Todavía no tiene estudios propios",
      "iPhone en revisión de Apple y Android en pruebas cerradas de Google Play",
    ],
    source: "/",
  },
  {
    id: "one-sec",
    name: "one sec",
    price: "Gratis para 1 app; Pro US$6,99/mes, US$19,99/año o US$99,99 de por vida",
    method: "Pausa con respiración o espera antes de abrir",
    devices: "iPhone, iPad, Mac, Android y navegador",
    pros: [
      "Estudios publicados (PNAS 2023, CHI 2024)",
      "Muchos tipos de pausa y bloqueo de sitios web",
    ],
    cons: ["La versión gratis cubre una sola app", "En Android faltan algunas funciones de iOS"],
    source: "https://apps.apple.com/us/app/id1532875441",
  },
  {
    id: "opal",
    name: "Opal",
    price: "Gratis con 1 regla; Pro US$99,99/año o US$19,99/mes",
    method: "Bloqueo por sesiones, horarios y límites, con modo estricto",
    devices: "iPhone, Mac y Android",
    pros: ["Bloqueos firmes y programables", "Muy completa para trabajar con foco"],
    cons: [
      "La versión paga es de las más caras",
      "Su ficha de la App Store declara datos usados para seguimiento",
    ],
    source: "https://www.opalapp.com/pricing",
  },
  {
    id: "screenzen",
    name: "ScreenZen",
    price: "Gratis; se financia con donaciones voluntarias",
    method: "Espera antes de abrir que puede crecer con el uso, más límites",
    devices: "iPhone, iPad, Mac y Android",
    pros: ["Gratis y sin suscripción", "La espera que se alarga desalienta el uso repetido"],
    cons: ["No cita estudios propios", "Tantas opciones pueden abrumar al empezar"],
    source: "https://apps.apple.com/us/app/id1541027222",
  },
  {
    id: "forest",
    name: "Forest",
    price: "Gratis (con anuncios en Android); Plus por suscripción",
    method: "Temporizador de concentración: un árbol crece si no usas el celular",
    devices: "iPhone, iPad, Android y navegador",
    pros: ["Muy buena para estudiar o trabajar por bloques", "Planta árboles reales con Trees for the Future"],
    cons: ["No actúa cuando abres una app por reflejo fuera de una sesión"],
    source: "https://apps.apple.com/us/app/id866450515",
  },
  {
    id: "bienestar-digital",
    name: "Bienestar digital (Android)",
    price: "Gratis, incluido en Android",
    method: "Panel de uso, temporizadores de apps, modo sin distracciones y hora de dormir",
    devices: "Android",
    pros: ["No hay que instalar nada", "En Pixel con Android 17 suma una pausa (Pause Point)"],
    cons: ["Los temporizadores cuentan minutos, no cortan el gesto de abrir", "El nombre y los menús cambian según la marca"],
    source: "https://support.google.com/android/answer/9346420?hl=es-419",
  },
  {
    id: "tiempo-en-pantalla",
    name: "Tiempo en pantalla (iPhone)",
    price: "Gratis, incluido en iOS",
    method: "Límites de tiempo, horarios y apps siempre permitidas",
    devices: "iPhone, iPad, Mac y Apple Watch",
    pros: ["Incluido en el sistema", "Con un código lo puede administrar otra persona"],
    cons: ["Sin código, el límite se ignora con un toque", "No tiene una pausa antes de abrir"],
    source: "https://support.apple.com/es-lamr/guide/iphone/iphb0c7313c9/ios",
  },
];

export default function CompareAppsPage() {
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
          Hay tres tipos de apps para usar menos el celular: las que{" "}
          <strong>bloquean</strong> (Opal), las que{" "}
          <strong>ponen una pausa antes de abrir</strong> (one sec, ScreenZen,
          Still) y las que <strong>cuentan tu tiempo y ponen límites</strong>{" "}
          (Tiempo en pantalla, Bienestar digital). Si lo que te pasa es que
          abres apps sin pensar, empieza por una pausa; si necesitas un tope
          firme, por un bloqueo. Esta comparativa se revisó el 24 de septiembre
          de 2026.
        </p>
      }
      path={page.path}
      published={page.published}
      related={[
        {
          href: "/alternativa-one-sec",
          title: "Alternativa gratis a one sec",
          description: "one sec y Still, punto por punto.",
        },
        {
          href: "/guias/reducir-tiempo-de-pantalla",
          title: "Reducir el tiempo de pantalla",
          description: "Tiempo en pantalla y Bienestar digital, paso a paso.",
        },
        {
          href: "/pausa-antes-de-abrir-apps",
          title: "Una pausa antes de abrir apps",
          description: "Pause Point de Android 17 y alternativas.",
        },
      ]}
      title={page.h1}
      toc={[
        { id: "tabla", label: "La tabla" },
        { id: "tipos", label: "Pausar, bloquear o limitar" },
        ...APPS.map((app) => ({ id: app.id, label: app.name })),
        { id: "cual-elegir", label: "Cuál elegir" },
      ]}
      updated={page.updated}
    >
      <h2 id="tabla">La tabla</h2>
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th scope="col">App</th>
              <th scope="col">Precio</th>
              <th scope="col">Cómo funciona</th>
              <th scope="col">Dispositivos</th>
            </tr>
          </thead>
          <tbody>
            {APPS.map((app) => (
              <tr key={app.id}>
                <th scope="row">{app.name}</th>
                <td>{app.price}</td>
                <td>{app.method}</td>
                <td>{app.devices}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <p>
        Todas están disponibles en español. Precios en dólares de las tiendas
        de EE. UU.; en otros países pueden cambiar.
      </p>

      <h2 id="tipos">Pausar, bloquear o limitar</h2>
      <ul>
        <li>
          <strong>Pausar</strong> actúa en el momento en que abres la app: no la
          prohíbe, te hace notar que la estás abriendo. Es lo que mejor apunta
          al gesto automático, y es lo que midieron los{" "}
          <Link href="/investigacion">estudios sobre pausas</Link>.
        </li>
        <li>
          <strong>Bloquear</strong> impide entrar durante un horario o una
          sesión. Sirve para rachas de trabajo o estudio, pero es fácil
          desactivarlo cuando molesta.
        </li>
        <li>
          <strong>Limitar</strong> cuenta minutos y avisa al llegar al tope.
          Ayuda a no pasarse, pero no evita las cien aperturas cortas del día.
        </li>
      </ul>

      {APPS.map((app) => (
        <section aria-labelledby={app.id} key={app.id}>
          <h2 id={app.id}>{app.name}</h2>
          <p>
            <strong>Precio:</strong> {app.price}. <strong>Cómo funciona:</strong>{" "}
            {app.method}. <strong>Dispositivos:</strong> {app.devices}.
          </p>
          <h3>A favor</h3>
          <ul>
            {app.pros.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>En contra</h3>
          <ul>
            {app.cons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            {app.source === "/" ? (
              <Link href="/">Conocer Still</Link>
            ) : (
              <a href={app.source} rel="noopener">
                Fuente
              </a>
            )}
          </p>
        </section>
      ))}

      <h2 id="cual-elegir">Cuál elegir</h2>
      <ul>
        <li>
          <strong>Abres apps sin pensar decenas de veces al día:</strong> una
          pausa (Still, one sec o ScreenZen).
        </li>
        <li>
          <strong>Necesitas horas sin distracciones para estudiar:</strong> un
          bloqueo (Opal) o un temporizador (Forest).
        </li>
        <li>
          <strong>Quieres algo sin instalar nada:</strong> Tiempo en pantalla o
          Bienestar digital, con un código para que sea firme.
        </li>
      </ul>
      <p>
        Se pueden combinar: por ejemplo, una pausa para el día a día y un
        horario del sistema para la noche.
      </p>
      <Note>
        <p>
          Still es una de las apps comparadas y esta página la escribe el equipo
          de Still. Por eso los datos de las demás vienen de sus propias
          páginas y fichas en las tiendas, enlazadas en cada sección.
        </p>
      </Note>
    </Article>
  );
}
