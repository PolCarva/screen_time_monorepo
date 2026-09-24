import Link from "next/link";

import { Note } from "@/components/content/article";

import type { Guide } from "./types";

const SOURCES = [
  ["Cambridge Dictionary: doomscrolling", "https://dictionary.cambridge.org/dictionary/english/doomscrolling"],
  ["BBC News (2018): las apps son adictivas «a propósito»", "https://www.bbc.co.uk/news/technology-44640959"],
  ["Winbush et al. (2025), PNAS: desbloqueos por día", "https://pmc.ncbi.nlm.nih.gov/articles/PMC12582163/"],
  ["Dekker y Baumgartner (2024): escala de grises", "https://doi.org/10.1177/20501579231212062"],
  ["Zimmermann y Sobolev (2023): escala de grises y bienestar", "https://doi.org/10.1089/cyber.2022.0027"],
  ["Olson et al. (2023): diez cambios juntos", "https://pmc.ncbi.nlm.nih.gov/articles/PMC9112639/"],
  ["Mertens et al. (2026): aviso a pantalla completa", "https://pmc.ncbi.nlm.nih.gov/articles/PMC13062480/"],
  ["Buchanan et al. (2021): noticias negativas y ánimo", "https://doi.org/10.1371/journal.pone.0257728"],
  ["Dekker et al. (2025): apagar notificaciones", "https://doi.org/10.1080/15213269.2024.2334025"],
  ["Fitz et al. (2019): agrupar notificaciones", "https://doi.org/10.1016/j.chb.2019.07.016"],
];

export const scrollingGuide: Guide = {
  page: "scrolling",
  lead: (
    <p>
      Para dejar de scrollear sirve más cambiar el entorno que apretar los
      dientes: que abrir la app cueste un poco más (una{" "}
      <strong>pausa antes de abrirla</strong>, sacarla de la pantalla de
      inicio), que la pantalla atraiga menos (<strong>escala de grises</strong>)
      y que decidas <strong>cuánto tiempo vas a estar antes de entrar</strong>.
      El scroll infinito no tiene final; el final lo pones tú, y es más fácil
      ponerlo antes de empezar.
    </p>
  ),
  toc: [
    { id: "que-es", label: "Qué es el doomscrolling" },
    { id: "por-que-cuesta", label: "Por qué cuesta tanto parar" },
    { id: "que-ayuda", label: "Qué ayuda, según los estudios" },
    { id: "plan", label: "Un plan en cinco pasos" },
    { id: "que-no", label: "Lo que ayuda menos de lo que parece" },
    { id: "noticias", label: "Si lo que scrolleas son noticias" },
    { id: "preguntas", label: "Preguntas" },
    { id: "fuentes", label: "Fuentes" },
  ],
  related: [
    {
      href: "/guias/usar-menos-el-celular",
      title: "Cómo dejar de usar tanto el celular",
      description: "Una guía práctica, sin culpa ni rachas.",
    },
    {
      href: "/guias/ver-menos-tiktok",
      title: "Cómo dejar de ver tanto TikTok",
      description: "Los ajustes de TikTok y una pausa antes de abrirla.",
    },
    {
      href: "/investigacion",
      title: "Qué dice la investigación sobre pausas",
      description: "Cuatro estudios, sus cifras y sus límites.",
    },
  ],
  body: (
    <>
      <h2 id="que-es">Qué es el doomscrolling</h2>
      <p>
        El diccionario de Cambridge lo define como pasar mucho tiempo en el
        celular o la computadora leyendo noticias malas o negativas. En la
        práctica se usa para cualquier scroll que sigue y sigue aunque ya no
        te esté haciendo bien. El scroll infinito, la lista que carga sola sin
        llegar nunca al final, suele atribuirse a Aza Raskin, que lo popularizó
        en 2006; en 2018 contó a la BBC que no buscaba hacer adicta a la gente
        y que hoy se siente culpable.
      </p>

      <h2 id="por-que-cuesta">Por qué cuesta tanto parar</h2>
      <ul>
        <li>
          <strong>No hay un final natural.</strong> Un libro termina un
          capítulo; el feed siempre tiene uno más.
        </li>
        <li>
          <strong>Casi todo empieza con un gesto.</strong> En un estudio con
          más de 10.000 adultos de EE. UU., la mediana fue de 41 desbloqueos
          del teléfono por día.
        </li>
        <li>
          <strong>El momento de decidir es muy corto.</strong> Entre tocar el
          ícono y ver el primer video no hay espacio para preguntarte si
          querías entrar.
        </li>
      </ul>

      <h2 id="que-ayuda">Qué ayuda, según los estudios</h2>
      <ul>
        <li>
          <strong>Una pausa antes de abrir la app.</strong> En un estudio
          publicado en PNAS, una pausa con la opción de salir redujo 57 % las
          aperturas de las apps elegidas en seis semanas (
          <Link href="/investigacion">ver el estudio y sus límites</Link>).
        </li>
        <li>
          <strong>Escala de grises.</strong> En un estudio con 84 personas, una
          semana con la pantalla en blanco y negro bajó el tiempo de pantalla
          unos 20 minutos por día. En otro ensayo también bajó el uso, aunque
          no cambió el bienestar ni las notas.
        </li>
        <li>
          <strong>Varios cambios juntos.</strong> En un ensayo que combinó diez
          cambios (notificaciones no esenciales apagadas, escala de grises,
          apps fuera de la pantalla de inicio, celular fuera de la habitación y
          otros), el tiempo de pantalla bajó 57 minutos por día, contra 11 en
          el grupo que solo lo medía.
        </li>
        <li>
          <strong>Un aviso que corta.</strong> En un ensayo reciente, un aviso a
          pantalla completa al llegar a un límite elegido por cada persona bajó
          29 minutos por día el uso de su app más problemática.
        </li>
      </ul>
      <p>
        Son estudios chicos y cortos, casi siempre con estudiantes: sirven para
        saber qué probar, no para prometer resultados.
      </p>

      <h2 id="plan">Un plan en cinco pasos</h2>
      <ol>
        <li>
          <strong>Elige una app y un momento.</strong> Por ejemplo: TikTok, de
          noche. Empezar por todo a la vez rara vez dura.
        </li>
        <li>
          <strong>Pon una pausa antes de abrirla.</strong> Con{" "}
          <Link href="/">Still</Link>, en{" "}
          <Link href="/configurar/iphone">iPhone</Link> o{" "}
          <Link href="/configurar/android">Android</Link>. Ves cuántas veces la
          abriste hoy y decides.
        </li>
        <li>
          <strong>Decide el final antes de entrar.</strong> Si entras, elige por
          cuánto tiempo; cuando termina, la pausa vuelve y la decisión se
          repite.
        </li>
        <li>
          <strong>De noche, escala de grises.</strong> En iPhone, con Filtros de
          colores; en Android, dentro del Modo Hora de dormir (
          <Link href="/guias/reducir-tiempo-de-pantalla#escala-grises">cómo activarla</Link>).
        </li>
        <li>
          <strong>Carga el celular fuera de la habitación.</strong> Así el
          scroll no es lo último del día ni lo primero de la mañana.
        </li>
      </ol>

      <h2 id="que-no">Lo que ayuda menos de lo que parece</h2>
      <ul>
        <li>
          <strong>Apagar todas las notificaciones.</strong> En un ensayo, una
          semana sin notificaciones no bajó el tiempo de pantalla ni las veces
          que se revisaba el teléfono, y subió el miedo a perderse algo. Otro
          estudio encontró mejor resultado agrupándolas tres veces por día.
        </li>
        <li>
          <strong>Solo mirar cuánto lo usas.</strong> Medir es el punto de
          partida, pero por sí solo casi no cambia el uso.
        </li>
        <li>
          <strong>Cortar de golpe.</strong> Sin reemplazo para esos momentos,
          el gesto vuelve. Mejor bajar de a poco y aceptar las recaídas.
        </li>
      </ul>

      <h2 id="noticias">Si lo que scrolleas son noticias</h2>
      <p>
        Las noticias tienen un problema extra: siempre hay una actualización
        más y casi ninguna es buena. Tres ideas:
      </p>
      <ul>
        <li>
          <strong>Elige un momento para informarte</strong>, por ejemplo al
          mediodía, y fuera de ese momento no abras la app de noticias.
        </li>
        <li>
          <strong>Prefiere formatos con final:</strong> un boletín diario, la
          portada de un diario o un resumen, en lugar de un feed que se
          actualiza solo.
        </li>
        <li>
          <strong>No las leas antes de dormir.</strong> Si el día fue pesado,
          la última noticia de la noche rara vez cambia algo que puedas hacer.
        </li>
      </ul>

      <h2 id="preguntas">Preguntas</h2>
      <details>
        <summary>¿Por qué no puedo dejar de scrollear?</summary>
        <p>
          Porque el feed no tiene final y el gesto de abrir la app es casi
          automático. No es falta de voluntad: por eso funciona mejor cambiar
          el entorno (una pausa, la escala de grises, el celular lejos) que
          proponerse resistir.
        </p>
      </details>
      <details>
        <summary>¿El doomscrolling causa ansiedad?</summary>
        <p>
          Hay estudios que asocian el doomscrolling con más malestar, pero casi
          todos miden una relación, no una causa. En un experimento, ver entre
          2 y 4 minutos de noticias negativas bajó el ánimo positivo en el
          momento. Si sientes que te afecta, habla con un profesional.
        </p>
      </details>
      <details>
        <summary>¿Cuál es la mejor app para dejar de scrollear?</summary>
        <p>
          Depende de lo que te pase: si abres apps sin pensar, una pausa; si
          necesitas horas sin distracciones, un bloqueo. Las comparamos en{" "}
          <Link href="/apps-para-dejar-el-celular">esta tabla</Link>.
        </p>
      </details>
      <Note>
        <p>
          Esta guía no es un tratamiento médico. Si el uso del celular afecta tu
          salud, tu sueño o tu trabajo, busca ayuda profesional.
        </p>
      </Note>

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
