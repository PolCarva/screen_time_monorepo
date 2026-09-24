import type { Metadata } from "next";
import Link from "next/link";

import { Article, Note, TableWrap } from "@/components/content/article";
import { CONTENT_PAGES } from "@/lib/content-pages";
import { STUDIES } from "@/lib/landing-content";
import { pageMetadata } from "@/lib/seo";

const page = CONTENT_PAGES.research;

export const metadata: Metadata = pageMetadata({
  path: page.path,
  title: page.title,
  description: page.description,
  type: "article",
  publishedTime: page.published,
  modifiedTime: page.updated,
  image: `${page.path}/opengraph-image`,
});

const study = (id: number) => STUDIES.find((item) => item.id === id)!;

export default function ResearchPage() {
  return (
    <Article
      citations={STUDIES.map((item) => ({
        name: item.citation.name,
        url: item.url,
        author: item.citation.author,
        datePublished: item.citation.datePublished,
        publisher: item.citation.publisher,
      }))}
      crumbs={[
        { name: "Inicio", path: "/" },
        { name: page.name, path: page.path },
      ]}
      description={page.description}
      eyebrow={page.eyebrow}
      lead={
        <p>
          Varios estudios independientes encontraron que una pausa corta antes
          de abrir una app reduce cuántas veces se abre: en el más citado, las
          aperturas bajaron <strong>57 % en seis semanas</strong>. Esos estudios
          midieron otras herramientas (sobre todo one sec) o el uso del teléfono
          en general. Still aplica el mismo principio y todavía no tiene un
          estudio propio.
        </p>
      }
      path={page.path}
      published={page.published}
      related={[
        {
          href: "/configurar/iphone",
          title: "Configurar la pausa en iPhone",
          description: "La automatización de Atajos, paso a paso.",
        },
        {
          href: "/configurar/android",
          title: "Configurar la pausa en Android",
          description: "El permiso de Accesibilidad y los ajustes por marca.",
        },
        {
          href: "/impacto",
          title: "El fondo que dona el 80 % de los anuncios",
          description: "Datos en vivo de Still: tiempo devuelto y donaciones.",
        },
      ]}
      title={page.h1}
      toc={[
        { id: "resumen", label: "Las cifras en una tabla" },
        { id: "pnas-2023", label: "PNAS, 2023" },
        { id: "dinamarca-2025", label: "Dinamarca, 2025" },
        { id: "lse-2021", label: "LSE, 2021" },
        { id: "chi-2024", label: "CHI, 2024" },
        { id: "por-que", label: "Por qué funciona una pausa" },
        { id: "limites", label: "Qué no sabemos" },
        { id: "still", label: "Cómo se mide Still" },
        { id: "referencias", label: "Referencias" },
      ]}
    >
      <h2 id="resumen">Las cifras en una tabla</h2>
      <TableWrap>
        <table>
          <thead>
            <tr>
              <th scope="col">Estudio</th>
              <th scope="col">Qué midió</th>
              <th scope="col">Resultado</th>
              <th scope="col">Muestra</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>[1] PNAS, 2023</td>
              <td>Pausa con mensaje y opción de salir antes de abrir una app</td>
              <td>57 % menos aperturas; 36 % de los intentos terminó en salir</td>
              <td>280 personas, 6 semanas (y 500 en un experimento controlado)</td>
            </tr>
            <tr>
              <td>[2] Dinamarca, 2025</td>
              <td>Esperas cortas, como 6 segundos, antes de abrir redes sociales</td>
              <td>31–36 % menos actividad diaria; 40 % menos en horario escolar</td>
              <td>269 jóvenes de 13 a 17 años, 6 semanas</td>
            </tr>
            <tr>
              <td>[3] LSE, 2021</td>
              <td>Quién inicia cada interacción con el teléfono</td>
              <td>89 % las empieza la persona, no una notificación</td>
              <td>37 personas, 1.130 interacciones grabadas</td>
            </tr>
            <tr>
              <td>[4] CHI, 2024</td>
              <td>Uso real de fricciones durante meses</td>
              <td>Menos intentos de apertura y aperturas más intencionales con el tiempo</td>
              <td>1.039 personas, 13,4 semanas en promedio</td>
            </tr>
          </tbody>
        </table>
      </TableWrap>

      <h2 id="pnas-2023">[1] Una pausa con opción de salir: PNAS, 2023</h2>
      <p>
        Investigadores del Instituto Max Planck y de la Universidad de
        Heidelberg siguieron durante seis semanas a 280 personas que usaban
        one sec, una app que muestra un mensaje y una espera corta antes de
        abrir la app elegida, con la opción de no entrar. En el 36 % de los
        intentos la persona cerró la app después de la pausa, los intentos de
        abrirla bajaron 37 % y, juntando ambos efectos, las aperturas reales
        cayeron 57 %. Un segundo experimento, controlado y con 500 personas,
        comparó variantes de la intervención.
      </p>
      <p>
        <a href={study(1).url} rel="noopener">
          Leer el estudio en PNAS
        </a>
      </p>

      <h2 id="dinamarca-2025">[2] Jóvenes y redes sociales: Dinamarca, 2025</h2>
      <p>
        La Autoridad de Competencia y Consumo de Dinamarca hizo un experimento
        de campo con 269 jóvenes de 13 a 17 años, que interactuaron más de 1,2
        millones de veces con redes sociales en seis semanas. Una de las
        intervenciones era una espera de seis segundos con una animación
        tranquila antes de abrir la app. La actividad diaria en redes bajó
        entre 31 % y 36 %; en horario escolar, las sesiones se redujeron a la
        mitad y la actividad 40 %; de noche, bajó cerca de 38 %, lo que dejó
        hasta 16 minutos más para dormir. La satisfacción con las redes no
        cambió.
      </p>
      <p>
        <a href={study(2).url} rel="noopener">
          Leer el informe (en inglés)
        </a>
      </p>

      <h2 id="lse-2021">[3] Casi todo lo empieza la mano: LSE, 2021</h2>
      <p>
        Un estudio de la London School of Economics grabó en primera persona
        el uso real del teléfono de 37 personas: 200 horas y 1.130
        interacciones. El 89 % las inició la persona y solo el 11 % una
        notificación. Es la razón de fondo de Still: la mayoría de las
        aperturas son un gesto, no una respuesta a algo.
      </p>
      <p>
        <a href={study(3).url} rel="noopener">
          Leer el estudio
        </a>
      </p>

      <h2 id="chi-2024">[4] Qué pasa con el tiempo: CHI, 2024</h2>
      <p>
        Un equipo de la Universidad LMU de Múnich analizó el uso de 1.039
        personas durante 13,4 semanas en promedio y encuestó a 249. Las
        fricciones cortas redujeron cuántas veces intentaban abrir las apps
        elegidas, sobre todo redes sociales, y las aperturas se volvieron más
        intencionales con el tiempo. Quienes dejaban la herramienta un tiempo
        y la volvían a activar recuperaban rápido ese uso más intencional.
      </p>
      <p>
        <a href={study(4).url} rel="noopener">
          Leer el estudio en la ACM Digital Library
        </a>
      </p>

      <h2 id="por-que">Por qué funciona una pausa</h2>
      <p>
        Abrir Instagram por reflejo es un hábito: el gesto llega antes que la
        intención. Una pausa corta no prohíbe nada; interrumpe la secuencia
        automática el tiempo justo para que aparezca la pregunta «¿quiero
        entrar?». Por eso importa que salir sea fácil y que entrar siga siendo
        posible: la decisión queda en la persona.
      </p>
      <p>
        Still suma dos cosas a esa idea: te muestra cuántas veces abriste esa
        app hoy, y si decides entrar, eliges por cuánto tiempo antes de que
        vuelva la pausa.
      </p>

      <h2 id="limites">Qué no sabemos todavía</h2>
      <ul>
        <li>
          Casi todos los datos vienen de personas que eligieron instalar una
          herramienta así: ya tenían ganas de cambiar.
        </li>
        <li>
          El estudio danés midió a adolescentes; los resultados pueden ser
          distintos en otras edades y países.
        </li>
        <li>
          Dos de los estudios ([1] y [4]) tienen entre sus autores al creador
          de one sec, la app que evaluaron.
        </li>
        <li>
          Los seguimientos duran semanas o meses; no sabemos cuánto dura el
          efecto después de un año.
        </li>
        <li>
          Still no es one sec: sus diferencias (el anuncio opcional, los pases,
          elegir el tiempo) pueden cambiar el efecto, para bien o para mal.
        </li>
      </ul>

      <h2 id="still">Cómo se mide Still</h2>
      <p>
        Still registra en tu teléfono cuántas veces se abrió cada app elegida
        y cuántas veces decidiste no entrar. Con esos conteos, sin nombres de
        apps, calculamos el tiempo devuelto y las personas que hacen pausas, y
        los publicamos en vivo en la <Link href="/impacto">página de impacto</Link>.
        Cuando tengamos un análisis propio con método y límites, lo vamos a
        publicar en esta página.
      </p>
      <Note>
        <p>
          Nada de esto es un tratamiento médico. Si sientes que el uso del
          celular afecta tu salud, habla con un profesional.
        </p>
      </Note>

      <h2 id="referencias">Referencias</h2>
      <ol>
        <li>
          Grüning, D. J., Riedel, F. y Lorenz-Spreen, P. (2023). Directing
          smartphone use through the self-nudge app one sec.{" "}
          <em>Proceedings of the National Academy of Sciences</em>, 120(8),
          e2213114120.{" "}
          <a href={study(1).url} rel="noopener">
            doi.org/10.1073/pnas.2213114120
          </a>
        </li>
        <li>
          Danish Competition and Consumer Authority (2025, 19 de junio).
          Disrupting social media habits — a field experiment with young Danish
          consumers.{" "}
          <a href={study(2).url} rel="noopener">
            en.kfst.dk
          </a>
        </li>
        <li>
          Heitmayer, M. y Lahlou, S. (2021). Why are smartphones disruptive? An
          empirical study of smartphone use in real-life contexts.{" "}
          <em>Computers in Human Behavior</em>, 116.{" "}
          <a href={study(3).url} rel="noopener">
            eprints.lse.ac.uk/107820
          </a>
        </li>
        <li>
          Haliburton, L., Grüning, D. J., Riedel, F., Schmidt, A. y Terzimehić,
          N. (2024). A longitudinal in-the-wild investigation of design
          frictions to prevent smartphone overuse. <em>CHI &apos;24</em>, ACM.{" "}
          <a href={study(4).url} rel="noopener">
            doi.org/10.1145/3613904.3642370
          </a>
        </li>
      </ol>
    </Article>
  );
}
