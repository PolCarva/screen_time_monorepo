"use client";

import { useRef } from "react";

import type { VideoSource } from "@/lib/site";

import styles from "./phone-video.module.css";

/**
 * A setup video behind a play button (D15). Rendered only when the recording
 * exists; the video loads when someone asks for it.
 */
export function PhoneVideo({ video, label }: { video: VideoSource; label: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const player = useRef<HTMLVideoElement>(null);

  return (
    <>
      <button
        className={styles.play}
        onClick={() => {
          dialog.current?.showModal();
          void player.current?.play();
        }}
        type="button"
      >
        <span aria-hidden="true" className={styles.icon}>
          <svg fill="currentColor" height="12" viewBox="0 0 24 24" width="12">
            <path d="M7 4.5v15l13-7.5z" fill="var(--chalk)" />
          </svg>
        </span>
        {label} · {video.duration}
      </button>
      <dialog
        aria-label={label}
        className={styles.dialog}
        onClose={() => player.current?.pause()}
        ref={dialog}
      >
        <video
          controls
          height={780}
          playsInline
          poster={video.poster}
          preload="none"
          ref={player}
          src={video.src}
          width={360}
        />
        <form method="dialog">
          <button className={styles.close} type="submit">
            Cerrar
          </button>
        </form>
      </dialog>
    </>
  );
}
