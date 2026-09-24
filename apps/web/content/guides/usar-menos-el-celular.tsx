import Link from "next/link";

import { Note, TableWrap } from "@/components/content/article";

import type { Guide } from "./types";

const SOURCES = [
  ["DataReportal: Digital 2025 México", "https://datareportal.com/reports/digital-2025-mexico"],
  ["DataReportal: Digital 2025 Argentina", "https://datareportal.com/reports/digital-2025-argentina"],
  ["DataReportal: Digital 2025 Colombia", "https://datareportal.com/reports/digital-2025-colombia"],
  ["DataReportal: Digital 2025 Chile", "https://datareportal.com/reports/digital-2025-chile"],
  ["Winbush et al. (2025), PNAS: desbloqueos por día", "https://pmc.ncbi.nlm.nih.gov/articles/PMC12582163/"],
  ["Olson et al. (2023): diez cambios juntos", "https://pmc.ncbi.nlm.nih.gov/articles/PMC9112639/"],
  ["Fitz et al. (2019): agrupar notificaciones", "https://doi.org/10.1016/j.chb.2019.07.016"],
  ["He et al. (2020): sin celular antes de dormir", "https://pmc.ncbi.nlm.nih.gov/articles/PMC7010281/"],
  ["Carter et al. (2016): dispositivos a la hora de dormir", "https://pmc.ncbi.nlm.nih.gov/articles/PMC5380441/"],
  ["Dekker y Baumgartner (2024): escala de grises", "https://doi.org/10.1177/20501579231212062"],
];

export const lessPhoneGuide: Guide = {
  page: "lessPhone",
  lead: (
    <p>
      Lo que más ayuda es combinar pocos cambios concretos: saber cuánto usas el
      celular y cuántas veces lo abres, poner una{" "}
      <strong>pausa donde está el reflejo</strong>, <strong>agrupar las
      notificaciones</strong> en vez de apagarlas todas y{" "}
      <strong>sacar el celular de la habitación</strong> de noche. En un
      ensayo que juntó cambios así, el tiempo de pantalla bajó casi una hora
      por día. Sin culpa y sin rachas: se trata de usarlo cuando lo decides.
    </p>
  ),
  toc: [
    { id: "hoy", label: "Empieza hoy, en diez minutos" },
    { id: "cuanto-es-mucho", label: "¿Cuánto es mucho?" },
    { id: "medir", label: "1. Mide cuánto y cuántas veces" },
    { id: "reflejo", label: "2. Una pausa donde está el reflejo" },
    { id: "notificaciones", label: "3. Agrupa las notificaciones" },
    { id: "noche", label: "4. De noche, fuera de la habitación" },
    { id: "grises", label: "5. Escala de grises" },
    { id: "trabajo", label: "En el trabajo o al estudiar" },
    { id: "reemplazos", label: "Qué hacer en vez del celular" },
    { id: "sin-culpa", label: "Sin culpa: qué esperar" },
    { id: "preguntas", label: "Preguntas" },
    { id: "fuentes", label: "Fuentes" },
  ],
  related: [
    {
      href: "/guias/reducir-tiempo-de-pantalla",
      title: "Cómo reducir el tiempo de pantalla",
      description: "Tiempo en pantalla y Bienestar digital, paso a paso.",
    },
    {
      href: "/guias/dejar-de-scrollear",
      title: "Cómo dejar de scrollear",
      description: "Por qué cuesta parar y qué ayuda según los estudios.",
    },
    {
      href: "/calculadora-tiempo-de-pantalla",
      title: "¿Cuántos años pasarás en el celular?",
      description: "Tus horas diarias, convertidas en días y años.",
    },
  ],
  body: (
    <>
      <h2 id="hoy">Empieza hoy, en diez minutos</h2>
      <ol>
        <li>Mira tu promedio diario de la última semana y anótalo.</li>
        <li>Elige las tres apps que más abres sin pensar.</li>
        <li>Ponles una pausa antes de abrirse.</li>
        <li>
          Muévelas a una carpeta en la segunda pantalla, fuera de la de inicio.
        </li>
        <li>Apaga las notificaciones de sugerencias y novedades de esas apps.</li>
        <li>Programa un horario sin apps para la noche.</li>
      </ol>
      <p>
        El resto de esta guía explica por qué cada paso ayuda y qué dicen los
        estudios.
      </p>

      <h2 id="cuanto-es-mucho">¿Cuánto es mucho?</h2>
      <p>
        No hay un número de horas correcto para adultos. Como referencia, así
        pasan en internet desde el celular, por día, los usuarios de 16 años o
        más según el informe Digital 2025 de DataReportal (encuesta de GWI de
        fines de 2024):
      </p>
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th scope="col">País</th>
              <th scope="col">Internet en el celular, por día</th>
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
          </tbody>
        </table>
      </TableWrap>
      <p>
        Son respuestas de una encuesta, no mediciones del teléfono. Más útil que
        compararte es preguntarte si ese tiempo es el que tú elegirías.
      </p>

      <h2 id="medir">1. Mide cuánto y cuántas veces</h2>
      <p>
        Mira tu tiempo en Tiempo en pantalla (iPhone) o Bienestar digital
        (Android), y fíjate también en cuántas veces abres cada app: en un
        estudio con más de 10.000 adultos, la mediana fue de 41 desbloqueos
        por día. Muchas aperturas cortas son la señal de un gesto automático.{" "}
        <Link href="/guias/reducir-tiempo-de-pantalla">Cómo verlo, paso a paso</Link>.
      </p>

      <h2 id="reflejo">2. Una pausa donde está el reflejo</h2>
      <p>
        Elige las dos o tres apps que abres sin pensar y ponles una pausa
        antes de abrirse. Con <Link href="/">Still</Link> aparece un segundo
        con cuántas veces la abriste hoy: vuelves, o entras por el tiempo que
        elijas. Sacar esas apps de la pantalla de inicio suma un poco más de
        fricción.
      </p>

      <h2 id="notificaciones">3. Agrupa las notificaciones</h2>
      <p>
        En un experimento, recibir las notificaciones agrupadas tres veces por
        día mejoró la atención, el ánimo y la sensación de control. Apagarlas
        todas, en cambio, subió la ansiedad por perderse algo. Deja activas las
        de personas y apaga o agrupa las de apps: en iPhone, el resumen de
        notificaciones las entrega a las horas que elijas.
      </p>

      <h2 id="noche">4. De noche, fuera de la habitación</h2>
      <p>
        Un metaanálisis con más de 125.000 niños y adolescentes asoció usar
        dispositivos a la hora de dormir con dormir menos y peor; es una
        asociación, no una prueba de causa. En un ensayo pequeño con adultos,
        dejar el celular 30 minutos antes de acostarse durante cuatro semanas
        hizo que se durmieran unos 12 minutos antes y durmieran unos 18 minutos
        más. Un despertador común ayuda a que el celular pueda quedarse afuera.
      </p>

      <h2 id="grises">5. Escala de grises</h2>
      <p>
        Con la pantalla en blanco y negro, las apps llaman menos la atención. En
        un estudio, una semana en escala de grises bajó el tiempo de pantalla
        unos 20 minutos por día.{" "}
        <Link href="/guias/reducir-tiempo-de-pantalla#escala-grises">Cómo activarla</Link>.
      </p>

      <h2 id="trabajo">En el trabajo o al estudiar</h2>
      <p>
        Para bloques de concentración sirven más los bloqueos y los
        temporizadores: el Modo sin distracciones de Android, un horario de
        Tiempo en pantalla o apps como Forest.{" "}
        <Link href="/apps-para-dejar-el-celular">Aquí las comparamos</Link>.
      </p>

      <h2 id="reemplazos">Qué hacer en vez del celular</h2>
      <p>
        El celular suele llenar huecos: la fila, el colectivo, los minutos
        antes de dormir. Si sacas el celular sin poner nada en su lugar, el
        gesto vuelve. Algunas ideas concretas:
      </p>
      <ul>
        <li>Un libro o una revista donde antes dejabas el celular.</li>
        <li>Un despertador común, para que el celular no duerma contigo.</li>
        <li>
          Audiolibros o música en vez de videos cuando viajas: escuchas sin
          mirar la pantalla.
        </li>
        <li>
          Para la fila o la espera, nada: aburrirse un rato también es
          descansar.
        </li>
      </ul>

      <h2 id="sin-culpa">Sin culpa: qué esperar</h2>
      <p>
        En un ensayo que combinó diez cambios como estos, el tiempo de pantalla
        bajó 57 minutos por día contra 11 en el grupo que solo lo medía. Pero
        los estudios son cortos, y medir sin cambiar nada casi no mueve el uso.
        Las recaídas son normales: lo importante es volver a elegir, no llevar
        una racha.
      </p>
      <Note>
        <p>
          Esta guía no es un tratamiento médico. Si el uso del celular afecta tu
          salud, tu sueño o tus relaciones, habla con un profesional.
        </p>
      </Note>

      <h2 id="preguntas">Preguntas</h2>
      <details>
        <summary>¿Cuántas horas es normal usar el celular?</summary>
        <p>
          No hay una cifra oficial para adultos. En México, Argentina, Colombia
          y Chile, las personas de 16 años o más dicen pasar entre 4 y 5 horas
          por día en internet desde el celular (DataReportal, 2025).
        </p>
      </details>
      <details>
        <summary>¿Cómo dejo de usar el celular de noche?</summary>
        <p>
          Carga el celular fuera de la habitación, usa un despertador común y
          programa un horario sin apps (Horario de Tiempo en pantalla en iPhone,
          Modo Hora de dormir en Android) que empiece media hora antes de
          acostarte.
        </p>
      </details>
      <details>
        <summary>¿Qué apps gratis ayudan a usar menos el celular?</summary>
        <p>
          Tiempo en pantalla y Bienestar digital vienen con el teléfono; Still y
          ScreenZen son gratis; one sec y Opal tienen versión gratis limitada.
          Están todas en{" "}
          <Link href="/apps-para-dejar-el-celular">nuestra comparativa</Link>.
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
