import Link from "next/link";

import { Note, TableWrap } from "@/components/content/article";

import type { Guide } from "./types";

const SOURCES = [
  ["Ver tu uso en Tiempo en pantalla (Apple, iOS 27)", "https://support.apple.com/es-lamr/guide/iphone/iphbfa595995/ios"],
  ["Establecer límites en Tiempo en pantalla (Apple)", "https://support.apple.com/es-lamr/guide/iphone/iphb0c7313c9/ios"],
  ["Filtros de colores en iPhone (Apple)", "https://support.apple.com/es-lamr/guide/iphone/iph3e2e1fb0/ios"],
  ["Bienestar digital en Android (Google)", "https://support.google.com/android/answer/9346420?hl=es-419"],
  ["Bienestar digital en Pixel (Google)", "https://support.google.com/pixelphone/answer/9137850?hl=es-419"],
  ["Mertens et al. (2026): límites con aviso a pantalla completa", "https://pmc.ncbi.nlm.nih.gov/articles/PMC13062480/"],
  ["Zimmermann y Sobolev (2023): medir y limitar", "https://doi.org/10.1089/cyber.2022.0027"],
  ["Temporizadores de aplicaciones en Samsung", "https://www.samsung.com/co/support/mobile-devices/galaxy-s10-how-to-use-the-digital-wellness-application-timer/"],
];

export const screenTimeGuide: Guide = {
  page: "screenTime",
  lead: (
    <p>
      Para reducir el tiempo de pantalla, primero mira el tuyo (Tiempo en
      pantalla en iPhone, Bienestar digital en Android), identifica las dos o
      tres apps que más lo disparan y actúa sobre ellas con tres capas: un{" "}
      <strong>límite diario</strong>, un <strong>horario sin apps</strong> y
      una <strong>pausa antes de abrirlas</strong>. Bajar de a poco funciona
      mejor que prohibirse todo de un día para otro.
    </p>
  ),
  toc: [
    { id: "ver-iphone", label: "Ver tu tiempo en iPhone" },
    { id: "ver-android", label: "Ver tu tiempo en Android" },
    { id: "que-apps", label: "Qué apps lo disparan" },
    { id: "limites", label: "Capa 1: límites diarios" },
    { id: "horarios", label: "Capa 2: horarios sin apps" },
    { id: "pausa", label: "Capa 3: una pausa antes de abrir" },
    { id: "escala-grises", label: "Extra: escala de grises" },
    { id: "primera-semana", label: "Tu primera semana" },
    { id: "preguntas", label: "Preguntas" },
    { id: "fuentes", label: "Fuentes" },
  ],
  related: [
    {
      href: "/guias/usar-menos-el-celular",
      title: "Cómo dejar de usar tanto el celular",
      description: "Hábitos y ajustes para usar menos el celular, sin culpa.",
    },
    {
      href: "/guias/usar-menos-instagram",
      title: "Cómo usar menos Instagram",
      description: "Cuatro formas, de la más suave a la más firme.",
    },
    {
      href: "/calculadora-tiempo-de-pantalla",
      title: "Calculadora de tiempo de pantalla",
      description: "Tus horas diarias, convertidas en días y años.",
    },
  ],
  body: (
    <>
      <h2 id="ver-iphone">Ver tu tiempo de pantalla en iPhone</h2>
      <p>
        Abre Configuración → <strong>Tiempo en pantalla</strong>. En iOS 27,
        toca <strong>Promedio diario</strong> y cambia entre Semana y Día. En
        iOS 26 la opción se llama «Ver toda actividad en apps y sitios». Si
        Tiempo en pantalla está apagado, actívalo con «Actividad en apps y
        sitios»: empieza a contar desde ese momento.
      </p>

      <h2 id="ver-android">Ver tu tiempo de pantalla en Android</h2>
      <p>
        Abre Configuración → <strong>Bienestar digital</strong>. El gráfico
        muestra el tiempo de uso, la cantidad de veces que abriste cada app y
        las notificaciones. En Samsung y Xiaomi la sección se llama{" "}
        <strong>Bienestar digital y controles parentales</strong>; en Samsung,
        toca la barra de tiempo de uso para ver el detalle por app.
      </p>

      <h3>Qué cuenta como tiempo de pantalla</h3>
      <p>
        El total incluye todo lo que haces con la pantalla encendida: mapas,
        videollamadas, música o leer. Por eso el número solo no dice mucho. En
        vez de apuntar a bajar el total, apunta al tiempo en las apps que no
        querías usar tanto.
      </p>

      <h2 id="que-apps">Qué apps lo disparan</h2>
      <p>
        No mires solo el total. Fíjate en dos cosas por app: el{" "}
        <strong>tiempo</strong> y las <strong>veces que la abriste</strong>. Una
        app con pocas aperturas y mucho tiempo necesita un límite; una con
        muchas aperturas cortas, casi siempre de reflejo, necesita algo que
        corte el gesto. Con dos o tres apps elegidas es suficiente para
        empezar.
      </p>

      <h2 id="limites">Capa 1: límites diarios</h2>
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th scope="col">Teléfono</th>
              <th scope="col">Dónde</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>iPhone (iOS 27)</td>
              <td>Tiempo en pantalla → Límites de tiempo → Categorías → +</td>
            </tr>
            <tr>
              <td>iPhone (iOS 26)</td>
              <td>Tiempo en pantalla → Límites para apps → Agregar límite</td>
            </tr>
            <tr>
              <td>Android (Pixel y otros)</td>
              <td>Bienestar digital → Temporizadores de apps (o Límites para apps)</td>
            </tr>
            <tr>
              <td>Samsung</td>
              <td>
                Bienestar digital y controles parentales → Temporizadores de
                aplicaciones
              </td>
            </tr>
          </tbody>
        </table>
      </TableWrap>
      <p>
        En iPhone, sin un código de Tiempo en pantalla el límite se puede
        ignorar. En Android, al agotarse el tiempo el ícono se atenúa hasta la
        medianoche.
      </p>

      <h2 id="horarios">Capa 2: horarios sin apps</h2>
      <ul>
        <li>
          <strong>iPhone:</strong> en iOS 27, «Horario de Tiempo en pantalla»
          (en iOS 26, «Tiempo desactivado»). Con «Permitir siempre» eliges qué
          apps y personas quedan disponibles.
        </li>
        <li>
          <strong>Android:</strong> el <strong>Modo Hora de dormir</strong> para
          la noche y el <strong>Modo sin distracciones</strong> para trabajar o
          estudiar, los dos en Bienestar digital.
        </li>
      </ul>

      <h2 id="pausa">Capa 3: una pausa antes de abrir</h2>
      <p>
        Los límites y horarios actúan sobre los minutos. Una pausa actúa sobre
        el momento en que abres la app sin haberlo decidido, que es cuando
        empieza casi todo el tiempo de pantalla que no querías. Con{" "}
        <Link href="/">Still</Link>, antes de las apps que elijas aparece un
        segundo con cuántas veces la abriste hoy; vuelves o entras por el
        tiempo que decidas. Se configura en{" "}
        <Link href="/configurar/iphone">iPhone</Link> o{" "}
        <Link href="/configurar/android">Android</Link>.
      </p>
      <p>
        Algunos Pixel con Android 17 traen una función parecida del sistema,{" "}
        <Link href="/pausa-antes-de-abrir-apps">Momento de pausa</Link>.
      </p>

      <h2 id="escala-grises">Extra: escala de grises</h2>
      <p>
        Una pantalla en blanco y negro hace menos atractivas las apps con
        muchos colores.
      </p>
      <ul>
        <li>
          <strong>iPhone:</strong> Configuración → Accesibilidad → Pantalla y
          tamaño de texto → <strong>Filtros de colores</strong>.
        </li>
        <li>
          <strong>Android:</strong> dentro del Modo Hora de dormir, en
          «Opciones de pantalla a la hora de dormir», activa{" "}
          <strong>Escala de grises</strong>.
        </li>
      </ul>
      <Note>
        <p>
          Ningún número de horas es «el correcto» para todo el mundo. La meta es
          que el tiempo en el celular sea el que tú decides, no el que decide
          el gesto.
        </p>
      </Note>

      <h2 id="primera-semana">Tu primera semana, día por día</h2>
      <ol>
        <li>
          <strong>Día 1:</strong> mira tu promedio diario de la última semana y
          anota las tres apps con más tiempo y las tres con más aperturas.
        </li>
        <li>
          <strong>Día 2:</strong> elige una sola meta concreta, por ejemplo
          «30 minutos menos por día». La{" "}
          <Link href="/calculadora-tiempo-de-pantalla">calculadora</Link> te
          muestra cuánto suma en un año.
        </li>
        <li>
          <strong>Día 3:</strong> pon una pausa antes de las apps con más
          aperturas.
        </li>
        <li>
          <strong>Día 4:</strong> pon un límite diario a la app con más tiempo,
          un poco por debajo de tu promedio, no la mitad.
        </li>
        <li>
          <strong>Día 5:</strong> programa un horario sin apps para la noche.
        </li>
        <li>
          <strong>Día 6:</strong> prueba un día con la pantalla en escala de
          grises y mira si notas la diferencia.
        </li>
        <li>
          <strong>Día 7:</strong> compara con el día 1. Quédate con lo que
          funcionó y ajusta lo que molestó demasiado.
        </li>
      </ol>

      <h2 id="preguntas">Preguntas</h2>
      <details>
        <summary>¿Los límites de tiempo funcionan?</summary>
        <p>
          Depende de cómo sean. Solo mirar cuánto usas el celular casi no
          cambia el uso. En un ensayo reciente, un límite elegido por cada
          persona, con un aviso a pantalla completa al llegar, bajó 29 minutos
          por día el uso de su app más problemática.
        </p>
      </details>
      <details>
        <summary>¿Qué hago si siempre ignoro el límite?</summary>
        <p>
          Dos opciones: que otra persona ponga el código de Tiempo en pantalla,
          o cambiar de estrategia y actuar antes de abrir la app con una pausa,
          en vez de después de pasar un rato adentro.
        </p>
      </details>
      <details>
        <summary>¿Cuánto debería bajar?</summary>
        <p>
          No hay una cifra correcta. Empezar con 30 minutos menos por día es una
          meta que se nota y se sostiene; puedes ajustarla después de la primera
          semana.
        </p>
      </details>

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
    </>
  ),
};
