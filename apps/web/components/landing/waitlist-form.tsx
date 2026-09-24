"use client";

import { useState, type FormEvent } from "react";

import styles from "./download-cta.module.css";

type FormState = "idle" | "submitting" | "success" | "error";

const PLATFORMS = [
  { value: "ios", label: "iPhone" },
  { value: "android", label: "Android" },
  { value: "both", label: "Los dos" },
] as const;

/** One email when Still is out in the person's store (D16). */
export function WaitlistForm() {
  const [state, setState] = useState<FormState>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/v1/beta/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          platform: form.get("platform"),
          consent: form.get("consent") === "on",
          company: form.get("company"),
          locale: navigator.language,
        }),
      });
      if (!response.ok) throw new Error("waitlist_failed");
      formElement.reset();
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.field}>
        <span className="eyebrow eyebrow--dark">Correo</span>
        <input
          autoComplete="email"
          name="email"
          placeholder="tu@correo.com"
          required
          type="email"
        />
      </label>
      <fieldset className={styles.platforms}>
        <legend className="eyebrow eyebrow--dark">Tu teléfono</legend>
        {PLATFORMS.map((platform) => (
          <label key={platform.value}>
            <input
              defaultChecked={platform.value === "both"}
              name="platform"
              type="radio"
              value={platform.value}
            />
            <span>{platform.label}</span>
          </label>
        ))}
      </fieldset>
      <label className={styles.consent}>
        <input name="consent" required type="checkbox" />
        <span>Acepto recibir un correo cuando Still esté publicada.</span>
      </label>
      <label aria-hidden="true" className={styles.trap}>
        <span>Empresa</span>
        <input autoComplete="off" name="company" tabIndex={-1} />
      </label>
      <button className={styles.submit} disabled={state === "submitting"} type="submit">
        {state === "submitting" ? "Guardando…" : "Avisarme"}
      </button>
      {state === "success" ? (
        <p aria-live="polite" className={styles.message}>
          Listo. Te escribimos una sola vez, cuando esté publicada.
        </p>
      ) : null}
      {state === "error" ? (
        <p aria-live="assertive" className={styles.message} role="alert">
          No pudimos guardar tu correo. Inténtalo de nuevo.
        </p>
      ) : null}
    </form>
  );
}
