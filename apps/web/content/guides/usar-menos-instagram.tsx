import Link from "next/link";

import { Note, TableWrap } from "@/components/content/article";

import type { Guide } from "./types";

const SOURCES = [
  ["Definir un límite de tiempo diario en Instagram", "https://help.instagram.com/2049425491975359"],
  ["Consultar cuánto tiempo pasaste en Instagram", "https://help.instagram.com/195902884574087"],
  ["Editar recordatorios para tomar un descanso", "https://help.instagram.com/750317295927782"],
  ["Activar o desactivar el modo descanso", "https://help.instagram.com/688407339404755"],
  ["Tiempo en pantalla en iPhone (Apple)", "https://support.apple.com/es-lamr/guide/iphone/iphb0c7313c9/ios"],
  ["Bienestar digital en Android (Google)", "https://support.google.com/android/answer/9346420?hl=es-419"],
  ["Dekker et al. (2025): apagar notificaciones", "https://doi.org/10.1080/15213269.2024.2334025"],
];

export const instagramGuide: Guide = {
  page: "instagram",
  lead: (
    <p>
      No hace falta borrar Instagram. Hay cuatro formas de usarla menos, de la
      más suave a la más firme: el <strong>límite diario</strong> de la propia
      app, el <strong>modo descanso</strong>, un <strong>límite del
      sistema</strong> (Tiempo en pantalla en iPhone, Bienestar digital en
      Android) y una <strong>pausa antes de abrirla</strong>. Si lo que quieres
      cortar es el reflejo de abrirla sin pensar, la pausa apunta justo a eso;
      si quieres un tope de minutos, usa un límite.
    </p>
  ),
  toc: [
    { id: "cuanto", label: "Cuánto la usas hoy" },
    { id: "limite-diario", label: "1. Límite diario de Instagram" },
    { id: "modo-descanso", label: "2. Recordatorios y modo descanso" },
    { id: "limite-sistema", label: "3. Límite del sistema" },
    { id: "pausa", label: "4. Una pausa antes de abrirla" },
    { id: "comparacion", label: "Cuál elegir" },
    { id: "mas-ideas", label: "Más ideas que ayudan" },
    { id: "preguntas", label: "Preguntas" },
    { id: "fuentes", label: "Fuentes" },
  ],
  related: [
    {
      href: "/guias/ver-menos-tiktok",
      title: "Cómo dejar de ver tanto TikTok",
      description: "Los mismos pasos, con los ajustes de TikTok.",
    },
    {
      href: "/guias/dejar-de-scrollear",
      title: "Cómo dejar de scrollear",
      description: "Por qué cuesta parar y qué ayuda de verdad.",
    },
    {
      href: "/configurar/iphone",
      title: "Pausa antes de abrir Instagram en iPhone",
      description: "La automatización de Atajos, paso a paso.",
    },
  ],
  body: (
    <>
      <h2 id="cuanto">Primero: mira cuánto la usas hoy</h2>
      <p>
        Instagram muestra tu promedio de los últimos siete días. Entra en tu
        perfil, abre el menú <strong>☰</strong> y, en «Cómo usas Instagram»,
        toca <strong>Tu actividad</strong> y luego <strong>Administración del
        tiempo</strong>. Anota el número: te va a servir para elegir el límite y
        para saber si lo que pruebas funciona.
      </p>

      <h2 id="limite-diario">1. El límite diario de Instagram</h2>
      <p>
        En tu perfil, abre el menú <strong>☰</strong>, toca{" "}
        <strong>Administración del tiempo</strong> y luego{" "}
        <strong>Límite diario</strong>. Elige cuánto tiempo quieres por día.
        Cuando llegas, Instagram te avisa. Funciona en Android, iPhone y iPad,
        no en la computadora.
      </p>
      <p>
        Las cuentas de adolescentes tienen un límite de una hora por día de
        forma predeterminada, y el padre, madre o tutor puede hacer que la app
        se bloquee al llegar al límite.
      </p>
      <Note>
        <p>
          Meta cambia estos menús seguido y sus propias páginas de ayuda no
          siempre coinciden. Si no ves la opción, busca «Administración del
          tiempo» en la configuración de la app.
        </p>
      </Note>

      <h2 id="modo-descanso">2. Recordatorios de descanso y modo descanso</h2>
      <p>
        <strong>Recordatorio de descanso:</strong> en Tu actividad, toca{" "}
        <strong>Tiempo en la app</strong> y luego{" "}
        <strong>Recordatorio de descanso</strong>. Elige cada cuánto quieres que
        Instagram te sugiera parar y toca «Activar». Sirve para cortar las
        sesiones largas, no para abrirla menos veces.
      </p>
      <p>
        <strong>Modo descanso:</strong> en Administración del tiempo, activa el
        modo descanso (en algunas versiones aparece como «Modo sueño») y elige
        días y horas. Mientras está activo, Instagram silencia las
        notificaciones y tu estado muestra que estás en modo descanso. En las
        cuentas de adolescentes viene activado de 22:00 a 7:00. Antes se llamaba
        «Modo silencio».
      </p>

      <h2 id="limite-sistema">3. Un límite del sistema</h2>
      <p>
        Los límites del teléfono funcionan aunque cierres sesión en Instagram o
        la uses desde otra app.
      </p>
      <h3>En iPhone (Tiempo en pantalla)</h3>
      <ol>
        <li>Abre Configuración → <strong>Tiempo en pantalla</strong>.</li>
        <li>
          En iOS 27, toca <strong>Límites de tiempo</strong>, elige la categoría
          o la app y toca <strong>+</strong>. En iOS 26 se llama{" "}
          <strong>Límites para apps</strong> → «Agregar límite».
        </li>
        <li>Elige el tiempo diario y, si quieres, personaliza los días.</li>
      </ol>
      <p>
        Sin un código de Tiempo en pantalla, el límite se puede ignorar con un
        toque. Si quieres que sea firme, pídele a alguien que ponga el código.
      </p>
      <h3>En Android (Bienestar digital)</h3>
      <ol>
        <li>Abre Configuración → <strong>Bienestar digital</strong>.</li>
        <li>
          Toca <strong>Temporizadores de apps</strong> (en algunas versiones,
          «Límites para apps»), elige Instagram y define el tiempo.
        </li>
        <li>
          En Samsung está en «Bienestar digital y controles parentales» →
          «Temporizadores de aplicaciones».
        </li>
      </ol>
      <p>
        Al agotarse el tiempo, Android atenúa el ícono de la app hasta la
        medianoche.
      </p>

      <h2 id="pausa">4. Una pausa antes de abrirla</h2>
      <p>
        Los límites cuentan minutos; una pausa ataca otra cosa: la cantidad de
        veces que abres Instagram sin haberlo decidido. Con{" "}
        <Link href="/">Still</Link>, cada vez que tocas Instagram aparece un
        segundo de pausa con cuántas veces la abriste hoy. Vuelves con un
        toque, o entras por el tiempo que elijas. En estudios con una pausa
        parecida, las aperturas bajaron 57 % en seis semanas (
        <Link href="/investigacion">ver la investigación</Link>).
      </p>
      <p>
        Cómo activarla: en iPhone, con una{" "}
        <Link href="/configurar/iphone">automatización de Atajos</Link>; en
        Android, con el <Link href="/configurar/android">permiso de Accesibilidad</Link>.
      </p>

      <h2 id="comparacion">Cuál elegir</h2>
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th scope="col">Opción</th>
              <th scope="col">Qué hace</th>
              <th scope="col">Mejor para</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Límite diario de Instagram</td>
              <td>Te avisa al llegar a los minutos que elegiste</td>
              <td>Tener un tope sin instalar nada</td>
            </tr>
            <tr>
              <td>Recordatorio y modo descanso</td>
              <td>Corta sesiones largas y silencia de noche</td>
              <td>Las noches y los ratos de estudio</td>
            </tr>
            <tr>
              <td>Límite del sistema</td>
              <td>Atenúa o bloquea la app al agotar el tiempo</td>
              <td>Un tope firme, mejor con código</td>
            </tr>
            <tr>
              <td>Pausa antes de abrir (Still)</td>
              <td>Pone un segundo entre el gesto y la app</td>
              <td>Abrirla menos veces por reflejo</td>
            </tr>
          </tbody>
        </table>
      </TableWrap>
      <p>
        Se pueden combinar: la pausa para las aperturas automáticas y un límite
        para los días en que igual se te va la hora.
      </p>

      <h2 id="mas-ideas">Más ideas que ayudan</h2>
      <ul>
        <li>
          <strong>Saca Instagram de la pantalla de inicio.</strong> Tener que
          buscarla suma un poco de fricción al gesto.
        </li>
        <li>
          <strong>Revisa las notificaciones.</strong> Deja las de mensajes de
          personas y apaga las de sugerencias y novedades. Apagar todas las
          notificaciones del teléfono, en cambio, no bajó el tiempo de pantalla
          en un ensayo y subió el miedo a perderse algo.
        </li>
        <li>
          <strong>Decide antes de entrar para qué entras.</strong> Contestar un
          mensaje y ver historias son cosas distintas; si lo decides antes, es
          más fácil salir cuando terminas.
        </li>
        <li>
          <strong>De noche, lejos.</strong> Cargar el celular fuera de la
          habitación evita que Instagram sea lo último del día.
        </li>
      </ul>

      <h2 id="preguntas">Preguntas</h2>
      <details>
        <summary>¿Se puede bloquear Instagram por horas?</summary>
        <p>
          Sí: el modo descanso de Instagram silencia la app en el horario que
          elijas, y en iPhone el «Horario de Tiempo en pantalla» (iOS 27) limita
          apps durante un intervalo. En Android, el Modo Hora de dormir hace algo
          parecido de noche.
        </p>
      </details>
      <details>
        <summary>¿Still bloquea Instagram?</summary>
        <p>
          No. Pone una pausa antes de abrirla. Siempre puedes entrar; la
          diferencia es que entras porque lo decidiste.
        </p>
      </details>
      <details>
        <summary>¿Instagram se entera de que uso Still?</summary>
        <p>
          No. Still no se conecta con Instagram ni con tu cuenta; solo detecta
          en tu teléfono que la app se abrió.
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
