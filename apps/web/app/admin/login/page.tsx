import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BrandLockup } from "@/components/brand-mark";
import { createServerSupabaseClient } from "@/lib/server-supabase";
import { isAdminUser } from "@/lib/supabase";

import { chooseAnotherEmail, requestAdminCode, verifyAdminCode } from "./actions";

const ERRORS: Record<string, string> = {
  email: "Escribe un correo válido.",
  code: "El código no es correcto o ya venció. Revisa el último correo.",
  rate: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
  expired: "Pasó demasiado tiempo. Pide un código nuevo.",
  configuration: "El acceso no está disponible en este momento.",
  "not-admin": "Esta cuenta no tiene acceso a operaciones.",
  "invalid-link": "El enlace ya no es válido. Pide un código nuevo.",
  "missing-code": "El enlace ya no es válido. Pide un código nuevo.",
  signin: "No se pudo iniciar sesión. Vuelve a intentarlo.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // An operator who is already signed in goes straight to the console.
  const client = await createServerSupabaseClient();
  const { data } = client ? await client.auth.getUser() : { data: { user: null } };
  if (data.user && (await isAdminUser(data.user.id))) redirect("/admin");

  const pendingEmail = (await cookies()).get("still_admin_login")?.value;
  const askingForCode = params.step === "code" && Boolean(pendingEmail);
  const error = typeof params.error === "string" ? ERRORS[params.error] : null;

  return (
    <main className="admin-login">
      <section className="login-card">
        <BrandLockup />
        <p className="mono-label">OPERACIONES / ACCESO PRIVADO</p>
        <h1>Acceso privado</h1>
        {askingForCode ? (
          <>
            <p>
              Si <strong>{pendingEmail}</strong> tiene acceso, le enviamos un
              correo. Abre el enlace <strong>en este mismo navegador</strong> y
              entrarás directo; la sesión queda abierta aquí.
            </p>
            {error ? <p className="notice notice--error">{error}</p> : null}
            <form action={verifyAdminCode}>
              <label htmlFor="code">¿El correo trae un código? Escríbelo</label>
              <input
                autoComplete="one-time-code"
                autoFocus
                id="code"
                inputMode="numeric"
                maxLength={10}
                name="code"
                pattern="[0-9 ]{6,12}"
                required
              />
              <button className="button button--dark" type="submit">
                Entrar
              </button>
            </form>
            <p className="login-card__hint">
              ¿No llegó? Revisa el spam. Los correos de acceso tienen un límite
              de unos pocos por hora: si ya pediste varios, espera un rato antes
              de pedir otro.
            </p>
            <form action={chooseAnotherEmail}>
              <button className="text-link" type="submit">
                Usar otro correo
              </button>
            </form>
          </>
        ) : (
          <>
            <p>
              Te enviamos un acceso por correo. Solo lo reciben las cuentas de
              operaciones; a cualquier otro correo no se le envía nada.
            </p>
            {error ? <p className="notice notice--error">{error}</p> : null}
            <form action={requestAdminCode}>
              <label htmlFor="email">Correo de administración</label>
              <input
                autoComplete="email"
                id="email"
                name="email"
                required
                type="email"
              />
              <button className="button button--dark" type="submit">
                Enviar acceso
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
