import { BrandLockup } from "@/components/brand-mark";

import { requestAdminLink } from "./actions";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return (
    <main className="admin-login">
      <section className="login-card">
        <BrandLockup />
        <p className="mono-label">OPERACIONES / ACCESO PRIVADO</p>
        <h1>Acceso privado</h1>
        <p>Recibirás un enlace de acceso. La cuenta debe existir en <code>admin_users</code>.</p>
        {params.sent === "1" && <p className="notice notice--success">Revisa tu correo para continuar.</p>}
        {params.error && <p className="notice notice--error">No se pudo iniciar sesión o la cuenta no tiene acceso.</p>}
        <form action={requestAdminLink}>
          <label htmlFor="email">Correo de administración</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
          <button className="button button--dark" type="submit">Enviar enlace</button>
        </form>
      </section>
    </main>
  );
}
