"use client";

import { useState, type FormEvent } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

export function BetaSignupForm() {
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
    <form className="beta-form" onSubmit={submit}>
      <label>
        <span>Email</span>
        <input autoComplete="email" name="email" required type="email" />
      </label>
      <label>
        <span>Plataforma</span>
        <select defaultValue="both" name="platform">
          <option value="ios">iOS</option>
          <option value="android">Android</option>
          <option value="both">Ambas</option>
        </select>
      </label>
      <label className="beta-form__consent">
        <input name="consent" required type="checkbox" />
        <span>Acepto recibir novedades sobre la beta privada.</span>
      </label>
      <label className="beta-form__trap" aria-hidden="true">
        <span>Empresa</span>
        <input autoComplete="off" name="company" tabIndex={-1} />
      </label>
      <button
        className="button button--chalk"
        disabled={state === "submitting"}
        type="submit"
      >
        {state === "submitting" ? "Guardando…" : "Solicitar acceso"}
      </button>
      {state === "success" ? (
        <p aria-live="polite">Solicitud registrada. Te contactaremos por email.</p>
      ) : null}
      {state === "error" ? (
        <p aria-live="assertive" role="alert">
          No pudimos guardar la solicitud. Inténtalo nuevamente.
        </p>
      ) : null}
    </form>
  );
}
