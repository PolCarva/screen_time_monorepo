import type { Metadata } from "next";
import Link from "next/link";

import { Article, Note } from "@/components/content/article";
import { CONTENT_PAGES } from "@/lib/content-pages";
import { pageMetadata } from "@/lib/seo";
import { REQUIREMENTS } from "@/lib/site";
import { ANDROID_LABELS as L } from "@/lib/system-labels";

const page = CONTENT_PAGES.android;

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

// Per-maker tips, the same ones Still shows in the app
// (apps/mobile/src/lib/android-oem.ts), with the maker's page on
// dontkillmyapp.com for its exact menus.
const MAKERS = [
  {
    id: "xiaomi",
    name: "Xiaomi, Redmi y POCO (HyperOS o MIUI)",
    tips: [
      "Activa el inicio automático de Still.",
      "Pon su ahorro de batería en «Sin restricciones».",
      "Permítele mostrar ventanas emergentes mientras está en segundo plano.",
    ],
    source: "https://dontkillmyapp.com/xiaomi",
  },
  {
    id: "samsung",
    name: "Samsung (One UI)",
    tips: [
      "Saca a Still de las apps que se ponen en suspensión.",
      "Desactiva la optimización de batería para Still.",
    ],
    source: "https://dontkillmyapp.com/samsung",
  },
  {
    id: "motorola",
    name: "Motorola, Pixel y Android de fábrica",
    tips: [
      "En Configuración → Apps → Still → Batería, elige «Sin restricciones».",
    ],
    source: "https://dontkillmyapp.com/motorola",
  },
  {
    id: "oppo",
    name: "Oppo, OnePlus y Realme",
    tips: ["Permite el inicio automático y la ejecución en segundo plano de Still."],
    source: "https://dontkillmyapp.com/oppo",
  },
  {
    id: "vivo",
    name: "vivo e iQOO",
    tips: ["Permite el inicio automático y la batería sin restricciones de Still."],
    source: "https://dontkillmyapp.com/vivo",
  },
  {
    id: "huawei",
    name: "Huawei y Honor",
    tips: [
      "Gestiona el inicio de Still de forma manual y deja todos los interruptores activos.",
    ],
    source: "https://dontkillmyapp.com/huawei",
  },
];

export default function AndroidSetupPage() {
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
          Still usa el permiso de Accesibilidad de Android solo para saber
          cuándo se abre una de las apps que elegiste y mostrar la pausa. Se
          activa en <strong>Configuración (o Ajustes) → {L.accessibility} →{" "}
          {L.downloadedApps} → Still → {q(L.useService)} → {L.allow}</strong>. En
          Xiaomi, Samsung, Oppo o vivo conviene además quitarle el ahorro de
          batería para que el sistema no la apague.
        </p>
      }
      path={page.path}
      published={page.published}
      related={[
        {
          href: "/configurar/iphone",
          title: "Configurar Still en iPhone",
          description: "La automatización de Atajos que muestra la pausa.",
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
        { id: "activar", label: "Activar Still" },
        { id: "que-hace", label: "Qué hace el permiso" },
        { id: "configuracion-restringida", label: "Configuración restringida" },
        { id: "por-marca", label: "Si Still se apaga sola" },
        { id: "si-no-funciona", label: "Si la pausa no aparece" },
        { id: "desactivar", label: "Cómo desactivarlo" },
      ]}
    >
      <h2 id="requisitos">Qué necesitas</h2>
      <ul>
        <li>Un teléfono con {REQUIREMENTS.android}.</li>
        <li>Still instalada desde Google Play.</li>
        <li>Dos minutos: son dos pasos, el permiso y elegir tus apps.</li>
      </ul>

      <h2 id="activar">Activar Still</h2>
      <p>
        Lo más fácil es abrir Still y seguir el botón de activación: te lleva
        directo a la pantalla correcta de Android y, al volver, a elegir tus
        apps. Si prefieres hacerlo a mano:
      </p>
      <ol>
        <li>
          Abre <strong>Configuración</strong> (en algunos teléfonos se llama{" "}
          <strong>Ajustes</strong>) y entra en {q(L.accessibility)}.
        </li>
        <li>
          Toca {q(L.downloadedApps)} y luego <strong>Still</strong>. En algunas
          marcas la lista se llama «Aplicaciones descargadas» o «Servicios
          instalados».
        </li>
        <li>Activa {q(L.useService)}.</li>
        <li>
          Android pregunta si quieres darle el control total del dispositivo.
          Toca {q(L.allow)}.
        </li>
        <li>Vuelve a Still y elige las apps que quieres pausar.</li>
      </ol>

      <h2 id="que-hace">Qué hace el permiso y qué no</h2>
      <p>
        Android muestra el mismo aviso para cualquier servicio de
        Accesibilidad («Ver y controlar la pantalla», «Ver y realizar
        acciones»), sin importar para qué lo use cada app. Still lo usa para
        dos cosas:
      </p>
      <ul>
        <li>saber qué app pasa al frente, para mostrar la pausa si es una de las que elegiste;</li>
        <li>cerrar un video flotante que tape la pausa.</li>
      </ul>
      <p>
        No lee lo que escribes ni lo que ves, y los nombres de las apps que
        eliges se quedan en tu teléfono. Lo explicamos con detalle en la{" "}
        <Link href="/privacy">política de privacidad</Link>.
      </p>

      <h2 id="configuracion-restringida">Si aparece «Configuración restringida»</h2>
      <p>
        Desde Android 13, si una app se instaló desde un archivo (APK) y no
        desde una tienda, Android bloquea su permiso de Accesibilidad hasta
        que lo autorices. Si instalaste Still desde Google Play, no te va a
        pasar. Si ves el aviso:
      </p>
      <ol>
        <li>Abre Configuración → <strong>Apps</strong> → Still ({q(L.appInfo)}).</li>
        <li>
          Toca el menú <strong>⋮</strong> (o «Más») y elige{" "}
          {q(L.allowRestrictedSettings)}. En España se llama «Permitir ajustes
          restringidos».
        </li>
        <li>Confirma y vuelve a {q(L.accessibility)} para activar Still.</li>
      </ol>
      <p>
        Google lo explica en su{" "}
        <a href="https://support.google.com/android/answer/12623953?hl=es-419" rel="noopener">
          ayuda sobre la configuración restringida
        </a>
        .
      </p>

      <h2 id="por-marca">Si Still se apaga sola: ajustes por marca</h2>
      <p>
        Algunos fabricantes cierran apps en segundo plano para ahorrar
        batería. Si le pasa a Still, la pausa deja de aparecer hasta que la
        abres otra vez. Estos ajustes lo evitan:
      </p>
      {MAKERS.map((maker) => (
        <section aria-labelledby={maker.id} key={maker.id}>
          <h3 id={maker.id}>{maker.name}</h3>
          <ul>
            {maker.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
          <p>
            <a href={maker.source} rel="noopener">
              Pasos con los menús de cada modelo
            </a>{" "}
            (en inglés, de dontkillmyapp.com).
          </p>
        </section>
      ))}
      <Note>
        <p>
          Los nombres de los menús cambian entre modelos y versiones. Si no
          encuentras una opción, busca «batería» o «inicio automático» en el
          buscador de Configuración.
        </p>
      </Note>

      <h2 id="si-no-funciona">Si la pausa no aparece</h2>
      <ul>
        <li>
          Revisa que {q(L.useService)} siga activado en {q(L.accessibility)}:
          algunas actualizaciones del sistema lo apagan.
        </li>
        <li>Abre Still y confirma que la app está en tu lista de apps con pausa.</li>
        <li>Aplica los ajustes de batería de tu marca de la sección anterior.</li>
        <li>
          Si nada funciona, escríbenos desde <Link href="/soporte">Soporte</Link>{" "}
          con la marca y el modelo de tu teléfono.
        </li>
      </ul>

      <h2 id="desactivar">Cómo desactivarlo</h2>
      <p>
        En {q(L.accessibility)} → {q(L.downloadedApps)} → Still, apaga{" "}
        {q(L.useService)}. También puedes desinstalar Still. Para borrar tu
        cuenta y tus datos, sigue <Link href="/eliminar-cuenta">estos pasos</Link>.
      </p>
    </Article>
  );
}
