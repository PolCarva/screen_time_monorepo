import Link from "next/link";

import { Note } from "@/components/content/article";

import type { Guide } from "./types";

const SOURCES = [
  ["Tiempo en pantalla (TikTok)", "https://www.tiktok.com/support/faq_detail?id=7543597459155687941&lang=es"],
  ["Tiempo en pantalla en iPhone (Apple)", "https://support.apple.com/es-lamr/guide/iphone/iphb0c7313c9/ios"],
  ["Bienestar digital en Android (Google)", "https://support.google.com/android/answer/9346420?hl=es-419"],
  ["Dekker y Baumgartner (2024): escala de grises", "https://doi.org/10.1177/20501579231212062"],
  ["Hagerty et al. (2026): escala de grises en estudiantes de medicina", "https://doi.org/10.3389/fdgth.2026.1816095"],
];

export const tiktokGuide: Guide = {
  page: "tiktok",
  lead: (
    <p>
      Lo que más ayuda a ver menos TikTok es combinar tres cosas: un{" "}
      <strong>tiempo en pantalla diario</strong> dentro de TikTok, los{" "}
      <strong>descansos y el recordatorio de la hora de dormir</strong>, y una{" "}
      <strong>pausa antes de abrir la app</strong> para cortar el gesto
      automático. No necesitas borrar tu cuenta: se trata de que abrirla vuelva
      a ser una decisión.
    </p>
  ),
  toc: [
    { id: "panel", label: "Mira tu tiempo en TikTok" },
    { id: "limite", label: "Tiempo en pantalla diario" },
    { id: "descansos", label: "Descansos y hora de dormir" },
    { id: "sistema", label: "Límite del teléfono" },
    { id: "pausa", label: "Una pausa antes de abrir" },
    { id: "por-que", label: "Por qué cuesta cerrar TikTok" },
    { id: "habitos", label: "Cambios pequeños que suman" },
    { id: "adolescentes", label: "Si tienes entre 13 y 17 años" },
    { id: "plan", label: "Un plan de dos semanas" },
    { id: "preguntas", label: "Preguntas" },
    { id: "fuentes", label: "Fuentes" },
  ],
  related: [
    {
      href: "/guias/usar-menos-instagram",
      title: "Cómo usar menos Instagram",
      description: "Límite diario, modo descanso y una pausa antes de abrir.",
    },
    {
      href: "/guias/dejar-de-scrollear",
      title: "Cómo dejar de scrollear",
      description: "Por qué el scroll infinito engancha y cómo cortarlo.",
    },
    {
      href: "/pausa-antes-de-abrir-apps",
      title: "Una pausa antes de abrir apps",
      description: "Lo que trae Android 17 y cómo tenerlo en cualquier teléfono.",
    },
  ],
  body: (
    <>
      <h2 id="panel">Mira tu tiempo en TikTok</h2>
      <p>
        En tu perfil, abre el menú <strong>☰</strong>, entra en{" "}
        <strong>Ajustes y privacidad</strong> (en algunos teléfonos aparece como
        «Configuración y privacidad») y toca{" "}
        <strong>Tiempo en pantalla</strong>. El panel muestra el tiempo de uso y
        cuántas veces abriste TikTok, con las últimas semanas para comparar.
      </p>
      <p>
        Mira las dos cifras: si TikTok se abre muchas veces por día en sesiones
        cortas, el problema es el gesto; si son pocas sesiones muy largas, el
        problema es cortar a tiempo. Y si la mayor parte del tiempo es de
        noche, empieza por el recordatorio de la hora de dormir.
      </p>

      <h2 id="limite">Tiempo en pantalla diario</h2>
      <p>
        En la misma sección, activa el tiempo en pantalla diario y elige un
        límite (hay opciones fijas o puedes configurar uno personalizado por
        día). Al llegar al límite, TikTok te pide cerrar la app o escribir un
        código de acceso para seguir.
      </p>
      <p>
        Si tienes entre 13 y 17 años, esta función viene activada en una hora
        por día.
      </p>

      <h2 id="descansos">Descansos y recordatorio de la hora de dormir</h2>
      <ul>
        <li>
          <strong>Descansos del tiempo en pantalla:</strong> TikTok te sugiere
          parar después del tiempo que elijas. Puedes aceptar o posponer 10
          minutos.
        </li>
        <li>
          <strong>Recordatorios de la hora de dormir:</strong> silencian las
          notificaciones en tu horario de descanso y te avisan cuando es hora
          de dormir.
        </li>
        <li>
          <strong>Novedades semanales:</strong> un resumen de tu tiempo de la
          semana, útil para ver si lo que cambiaste funciona.
        </li>
      </ul>

      <h2 id="sistema">Un límite del teléfono</h2>
      <p>
        En iPhone, en Configuración → Tiempo en pantalla →{" "}
        <strong>Límites de tiempo</strong> (iOS 27) o «Límites para apps» (iOS
        26). En Android, en Configuración → Bienestar digital →{" "}
        <strong>Temporizadores de apps</strong>. Te sirve si TikTok te convence
        de seguir con el código de acceso.
      </p>

      <h2 id="pausa">Una pausa antes de abrir TikTok</h2>
      <p>
        Los límites actúan cuando ya pasaste un buen rato adentro. Una pausa
        actúa antes: un segundo entre tocar el ícono y ver el primer video. Con{" "}
        <Link href="/">Still</Link> ves cuántas veces abriste TikTok hoy y
        eliges: vuelves, o entras por el tiempo que decidas. Al terminar ese
        tiempo, vuelve la pausa.
      </p>
      <p>
        Actívala en <Link href="/configurar/iphone">iPhone</Link> o en{" "}
        <Link href="/configurar/android">Android</Link>.
      </p>

      <h2 id="por-que">Por qué cuesta cerrar TikTok</h2>
      <p>
        TikTok muestra videos cortos, uno tras otro, que empiezan solos y no
        tienen un final. Cada video dura poco, así que la pregunta «¿sigo?» se
        hace decenas de veces por sesión y casi siempre gana el siguiente. Por
        eso ayuda más poner el límite antes de entrar (cuánto tiempo, para
        qué) que intentar cortar en medio del feed.
      </p>

      <h2 id="habitos">Cambios pequeños que suman</h2>
      <ul>
        <li>
          Saca TikTok de la pantalla de inicio: tener que buscarla ya es un
          poco de fricción.
        </li>
        <li>
          Deja el celular cargando fuera de la habitación, así TikTok no es lo
          último que ves antes de dormir.
        </li>
        <li>
          Decide antes de entrar para qué abres la app y por cuánto; con Still
          lo eliges en la misma pausa.
        </li>
      </ul>
      <h2 id="adolescentes">Si tienes entre 13 y 17 años</h2>
      <p>
        TikTok ya trae algunos ajustes activados para cuentas de 13 a 17 años:
        el tiempo en pantalla diario viene en una hora, y los recordatorios de
        la hora de dormir silencian las notificaciones durante la noche. Si
        eres madre, padre o tutor, la Sincronización familiar de TikTok permite
        ver y administrar estos ajustes desde tu cuenta.
      </p>

      <h2 id="plan">Un plan de dos semanas</h2>
      <ol>
        <li>
          <strong>Semana 1:</strong> no cambies nada salvo poner la pausa antes
          de abrir TikTok. Al final, mira en el panel cuántas veces la abriste
          y cuánto tiempo pasaste.
        </li>
        <li>
          <strong>Semana 2:</strong> suma un tiempo en pantalla diario un poco
          por debajo de tu promedio y el recordatorio de la hora de dormir.
          Compara con la semana anterior.
        </li>
      </ol>
      <p>
        Si algo te molestó demasiado, ajústalo en vez de abandonar todo: lo que
        se sostiene funciona mejor que lo que se promete de golpe.
      </p>
      <Note>
        <p>
          Nada de esto es un tratamiento. Si sientes que el uso del celular
          afecta tu salud o tu sueño, habla con un profesional.
        </p>
      </Note>

      <h2 id="preguntas">Preguntas</h2>
      <details>
        <summary>¿Cómo bloqueo TikTok en mi celular por un tiempo?</summary>
        <p>
          Con el tiempo en pantalla diario de TikTok, o con un límite del
          sistema (Tiempo en pantalla en iPhone, Bienestar digital en Android).
          Para que no se pueda saltar, usa un código que no sepas tú.
        </p>
      </details>
      <details>
        <summary>¿Es mejor borrar TikTok o limitarlo?</summary>
        <p>
          Borrarla funciona si quieres dejarla del todo, pero si la usas para
          algo que te importa (amigos, un proyecto, aprender), limitarla y poner
          una pausa antes de abrirla suele sostenerse mejor que un corte total.
        </p>
      </details>
      <details>
        <summary>¿Sirve poner el celular en escala de grises?</summary>
        <p>
          Puede ayudar: en estudios con estudiantes, una o dos semanas en
          escala de grises bajaron el tiempo de pantalla entre 20 y 30 minutos
          por día. Los videos pierden atractivo en blanco y negro.{" "}
          <Link href="/guias/reducir-tiempo-de-pantalla#escala-grises">Cómo activarla</Link>.
        </p>
      </details>
      <details>
        <summary>¿Se puede saltar el límite de TikTok?</summary>
        <p>
          Si lo pusiste tú, sí: al llegar al límite puedes escribir tu código
          de acceso para seguir. Si lo configuró un adulto con la
          Sincronización familiar, lo administra esa persona.
        </p>
      </details>
      <details>
        <summary>¿Still borra o bloquea TikTok?</summary>
        <p>
          No. Pone una pausa antes de abrirla. Tu cuenta y tus videos no se
          tocan.
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
