import type { Metadata } from "next";
import Link from "next/link";

import { Article, Note } from "@/components/content/article";
import { CONTENT_PAGES } from "@/lib/content-pages";
import { pageMetadata } from "@/lib/seo";
import { REQUIREMENTS } from "@/lib/site";
import { SHORTCUTS_LABELS as L } from "@/lib/system-labels";

const page = CONTENT_PAGES.iphone;

export const metadata: Metadata = pageMetadata({
  path: page.path,
  title: page.title,
  description: page.description,
  type: "article",
  publishedTime: page.published,
  modifiedTime: page.updated,
  image: `${page.path}/opengraph-image`,
});

const q = (label: string) => `«${label}»`;

export default function IphoneSetupPage() {
  return (
    <Article
      crumbs={[
        { name: "Inicio", path: "/" },
        { name: page.name, path: page.path },
      ]}
      description={page.description}
      eyebrow={page.eyebrow}
      lead={
        <p>
          Con una automatización personal de Atajos:{" "}
          <strong>
            {q("Cuando se abra Instagram")} → {q(L.stillAction)}
          </strong>
          . Se crea una vez por app, tarda unos dos minutos y desde ahí Still
          aparece un segundo antes de que Instagram se abra. No bloquea nada:
          desde la pausa vuelves o entras por el tiempo que elijas.
        </p>
      }
      path={page.path}
      published={page.published}
      related={[
        {
          href: "/configurar/android",
          title: "Configurar Still en Android",
          description: "El permiso de Accesibilidad y los ajustes de batería por marca.",
        },
        {
          href: "/investigacion",
          title: "Qué dice la investigación",
          description: "Por qué una pausa corta cambia cuántas veces abres una app.",
        },
        {
          href: "/impacto",
          title: "El fondo que dona el 80 % de los anuncios",
          description: "Cuánto se reunió, a qué proyecto va y el comprobante.",
        },
      ]}
      title={page.h1}
      toc={[
        { id: "requisitos", label: "Qué necesitas" },
        { id: "desde-still", label: "La forma más rápida" },
        { id: "paso-a-paso", label: "Paso a paso en Atajos" },
        { id: "varias-apps", label: "Varias apps" },
        { id: "por-que-se-ve", label: "Por qué la app se ve un instante" },
        { id: "si-no-funciona", label: "Si no funciona" },
        { id: "quitarla", label: "Cómo quitarla" },
        { id: "preguntas", label: "Preguntas" },
      ]}
    >
      <h2 id="requisitos">Qué necesitas</h2>
      <ul>
        <li>Un iPhone con {REQUIREMENTS.ios}.</li>
        <li>
          La app <strong>Atajos</strong> de Apple. Viene con el iPhone; si la
          borraste, se descarga gratis desde la App Store.
        </li>
        <li>
          Still instalada. Ella pone la acción {q(L.stillAction)} en Atajos.
        </li>
      </ul>

      <h2 id="desde-still">La forma más rápida: desde Still</h2>
      <p>
        Abre Still y elige las apps que abres por reflejo. La guía de Still te
        muestra cada pantalla de Atajos con el botón que tienes que tocar,
        con las mismas palabras que ves en tu iPhone, y al final te deja probar
        que funciona. Still nunca crea, edita ni lee tus automatizaciones: iOS
        no se lo permite a ninguna app, así que ese paso siempre lo haces tú.
      </p>

      <h2 id="paso-a-paso">Paso a paso en Atajos</h2>
      <p>Si prefieres hacerlo por tu cuenta, estos son los pasos con Instagram de ejemplo:</p>
      <ol>
        <li>
          Abre <strong>Atajos</strong> y ve a la pestaña {q(L.automation)}.
        </li>
        <li>
          Crea una automatización nueva con el botón <strong>+</strong>. En la
          lista de {q(L.personalAutomation)}, busca {q(L.app)} y tócala.
        </li>
        <li>
          Toca {q(L.choose)}, marca <strong>Instagram</strong> y confirma.
        </li>
        <li>
          Deja marcada la opción {q(L.isOpened)}, elige {q(L.runImmediately)} y
          deja apagado {q(L.notifyWhenRun)}. Toca {q(L.next)}.
        </li>
        <li>Toca {q(L.createNewShortcut)}.</li>
        <li>
          En {q(L.searchActions)} escribe <strong>Still</strong> y toca{" "}
          {q(L.stillAction)}.
        </li>
        <li>
          Toca {q(L.appNameParam)} y elige <strong>Instagram</strong>, la misma
          app del paso 3.
        </li>
        <li>
          Guarda con el <strong>✓</strong> azul. Abre Instagram: primero
          aparece Still.
        </li>
      </ol>
      <Note>
        <p>
          Si en el paso 4 queda marcado «Ejecutar después de confirmar», iOS te
          va a preguntar antes de cada pausa. Con {q(L.runImmediately)} la pausa
          aparece sola.
        </p>
      </Note>

      <h2 id="varias-apps">Varias apps</h2>
      <p>
        Lo más simple es una automatización por app: repite los pasos para
        TikTok, YouTube o la que quieras. Si prefieres una sola automatización
        para varias apps, la guía dentro de Still te muestra cómo hacerlo con
        la variable «App actual», así la pausa sabe qué app se abrió.
      </p>

      <h2 id="por-que-se-ve">Por qué la app se ve un instante antes de la pausa</h2>
      <p>
        iOS primero abre la app y después ejecuta la automatización. Ese
        instante en que ves Instagram antes de que aparezca Still lo decide
        iOS, no Still, y pasa con cualquier automatización de Atajos.
      </p>

      <h2 id="si-no-funciona">Si no funciona</h2>
      <ul>
        <li>
          Revisa que la automatización esté activada: en {q(L.automation)},
          toca la automatización y mira el interruptor de arriba.
        </li>
        <li>
          Confirma que dice {q(L.runImmediately)} y no «Ejecutar después de
          confirmar».
        </li>
        <li>
          Comprueba que la app de {q(L.appNameParam)} sea la misma que la del
          disparador {q("Cuando se abra")}.
        </li>
        <li>
          Si no encuentras {q(L.stillAction)} al buscar Still, abre Still una
          vez y vuelve a buscar.
        </li>
      </ul>

      <h2 id="quitarla">Cómo quitarla</h2>
      <p>
        En Atajos, pestaña {q(L.automation)}, desliza la automatización hacia
        la izquierda y elimínala. Still deja de aparecer antes de esa app. Si
        quieres borrar también tu cuenta y tus datos, sigue{" "}
        <Link href="/eliminar-cuenta">estos pasos</Link>.
      </p>

      <h2 id="preguntas">Preguntas</h2>
      <details>
        <summary>¿Still puede crear la automatización por mí?</summary>
        <p>
          No. iOS no deja que una app cree automatizaciones personales. Still te
          guía con las pantallas de tu iPhone, pero el último toque es tuyo.
        </p>
      </details>
      <details>
        <summary>¿Es lo mismo que Tiempo en pantalla?</summary>
        <p>
          No. Tiempo en pantalla pone un límite diario y bloquea la app al
          llegar. Still pone una pausa cada vez que la abres, y desde ahí tú
          decides si vuelves o entras y por cuánto tiempo.
        </p>
      </details>
      <details>
        <summary>¿Qué ve Still de mis apps?</summary>
        <p>
          Solo sabe qué app elegiste para pausar y cuántas veces se abrió. Los
          nombres de tus apps y tu historial detallado se quedan en tu iPhone.
        </p>
      </details>
    </Article>
  );
}
