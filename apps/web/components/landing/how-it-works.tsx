import Link from "next/link";

import { REQUIREMENTS, VIDEOS, type VideoSource } from "@/lib/site";

import styles from "./how-it-works.module.css";
import { ChooseAppsScreen, PauseScreen, Phone, SetupScreen } from "./phone";
import { PhoneVideo } from "./phone-video";
import { PlatformPanel, PlatformTabs } from "./platform-tabs";

function Card({
  children,
  video,
  label,
}: {
  children: React.ReactNode;
  video: VideoSource | null;
  label: string;
}) {
  return (
    <div className={styles.card}>
      <div className="phone-scaler">{children}</div>
      {video ? <PhoneVideo label={label} video={video} /> : null}
    </div>
  );
}

function StepText({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className={styles.text}>
      <span className={`eyebrow eyebrow--dark ${styles.number}`}>{number}</span>
      <h3 className={styles.stepTitle}>{title}</h3>
      <p className={styles.stepBody}>{body}</p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className={styles.section} id="como-funciona">
      <div className={`shell ${styles.inner}`}>
        <PlatformTabs
          heading={
            <div className={styles.heading}>
              <p className="eyebrow eyebrow--dark">Cómo funciona</p>
              <h2 className={styles.title} id="how-title">
                Tres pasos. Dos minutos.
              </h2>
            </div>
          }
        >
          <ol aria-label="Pasos para empezar" className={styles.steps} tabIndex={0}>
            <li className={styles.step}>
              <Card label="Video: elegir las apps" video={VIDEOS.chooseApps}>
                <Phone size="md" tone="light">
                  <ChooseAppsScreen />
                </Phone>
              </Card>
              <StepText
                body="Marca las que abres por reflejo. La lista se queda en tu teléfono."
                number="01"
                title="Elige las apps"
              />
            </li>
            <li className={styles.step}>
              <PlatformPanel platform="android">
                <Card label="Video: activar Still en Android" video={VIDEOS.androidSetup}>
                  <Phone size="md" tone="light">
                    <SetupScreen platform="android" />
                  </Phone>
                </Card>
              </PlatformPanel>
              <PlatformPanel platform="ios">
                <Card label="Video: crear el atajo en iPhone" video={VIDEOS.iosSetup}>
                  <Phone size="md" tone="light">
                    <SetupScreen platform="ios" />
                  </Phone>
                </Card>
              </PlatformPanel>
              <PlatformPanel platform="android">
                <StepText
                  body="Enciende Still en Accesibilidad. Solo lo usa para saber cuándo se abre una de tus apps."
                  number="02"
                  title="Activa la pausa"
                />
              </PlatformPanel>
              <PlatformPanel platform="ios">
                <StepText
                  body="Una automatización personal en Atajos, una vez por app. Still te muestra cada toque."
                  number="02"
                  title="Crea el atajo"
                />
              </PlatformPanel>
            </li>
            <li className={styles.step}>
              <Card label="Video: la pausa" video={VIDEOS.pause}>
                <Phone size="md" tone="dark">
                  <PauseScreen app="TikTok" opens={4} />
                </Phone>
              </Card>
              <StepText
                body="Vuelves con un toque, o entras con un anuncio opcional que suma al fondo de la semana."
                number="03"
                title="Aparece la pausa"
              />
            </li>
          </ol>
          <PlatformPanel platform="android">
            <div className={styles.note}>
              <p>{REQUIREMENTS.android} · se instala desde Google Play.</p>
              <Link className="underline-link" href="/configurar/android">
                Guía completa para Android
              </Link>
            </div>
          </PlatformPanel>
          <PlatformPanel platform="ios">
            <div className={styles.note}>
              <p>{REQUIREMENTS.ios} · la automatización usa la app Atajos de Apple.</p>
              <Link className="underline-link" href="/configurar/iphone">
                Guía completa para iPhone
              </Link>
            </div>
          </PlatformPanel>
        </PlatformTabs>
      </div>
    </section>
  );
}
