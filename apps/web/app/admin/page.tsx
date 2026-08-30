import { BrandLockup } from "@/components/brand-mark";
import { ImpactCard, ImpactUnavailable } from "@/components/impact-card";
import { requireAdminPage } from "@/lib/admin";
import { getCurrentImpactWeek } from "@/lib/impact";

import {
  closeVoting,
  confirmRevenue,
  openNextWeek,
  recordDonation,
} from "./actions";
import { AdminActionForm } from "./admin-action-form";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const access = await requireAdminPage();
  const result = await getCurrentImpactWeek();

  if (!access.configured) {
    return (
      <main className="admin-shell shell-wide">
        <header className="admin-header">
          <BrandLockup />
          <span>SETUP MODE</span>
        </header>
        <section className="admin-title">
          <p className="mono-label">OPERACIONES / SIN CONEXIÓN</p>
          <h1>Conecta Supabase para operar.</h1>
          <p>
            No hay datos de demostración ni acciones operativas disponibles en
            este estado.
          </p>
        </section>
        <ImpactUnavailable state="unconfigured" compact />
        <div className="setup-grid">
          <code>NEXT_PUBLIC_SUPABASE_URL</code>
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
          <code>SUPABASE_SERVICE_ROLE_KEY</code>
        </div>
      </main>
    );
  }

  if (result.state !== "ready") {
    return (
      <main className="admin-shell shell-wide">
        <header className="admin-header">
          <BrandLockup />
          <span>OPERACIONES / {access.user.email}</span>
        </header>
        <section className="admin-title">
          <p className="mono-label">SEMANA ACTIVA</p>
          <h1>Fondo de impacto</h1>
          <p>
            Las cifras se publican solamente cuando existe un registro real.
          </p>
        </section>
        <div className="admin-grid">
          <ImpactUnavailable state={result.state} compact />
          {result.state === "empty" && (
            <section className="operation-card">
              <p className="mono-label">SIGUIENTE ACCIÓN</p>
              <AdminActionForm
                action={openNextWeek}
                label="Abrir semana actual"
                pendingLabel="Abriendo…"
              >
                <h2>Abrir una semana</h2>
                <p>
                  Crea el primer registro con las entidades activas y la
                  configuración vigente.
                </p>
              </AdminActionForm>
            </section>
          )}
        </div>
      </main>
    );
  }

  const week = result.week;

  const selected = week.candidates.slice().sort((a, b) => b.votes - a.votes)[0];
  return (
    <main className="admin-shell shell-wide">
      <header className="admin-header">
        <BrandLockup />
        <span>OPERACIONES / {access.user.email}</span>
      </header>
      <section className="admin-title">
        <p className="mono-label">SEMANA ACTIVA</p>
        <h1>Fondo de impacto</h1>
        <p>Cada cambio queda registrado en el audit log.</p>
      </section>
      <div className="admin-grid">
        <ImpactCard week={week} compact />
        <section className="operation-card">
          <p className="mono-label">SIGUIENTE ACCIÓN</p>
          {week.status === "open" && (
            <AdminActionForm
              action={closeVoting}
              label="Cerrar votación"
              pendingLabel="Cerrando…"
            >
              <input type="hidden" name="weekId" value={week.id} />
              <h2>Cerrar votación</h2>
              <p>
                Congela la votación. Esta acción no elige automáticamente una
                entidad.
              </p>
            </AdminActionForm>
          )}
          {week.status === "voting_closed" && (
            <AdminActionForm
              action={confirmRevenue}
              label="Confirmar y congelar 80/20"
              pendingLabel="Confirmando…"
            >
              <input type="hidden" name="weekId" value={week.id} />
              <h2>Confirmar ingreso</h2>
              <label>
                Ingreso bruto confirmado (USD)
                <input
                  name="grossRevenue"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                />
              </label>
            </AdminActionForm>
          )}
          {week.status === "donation_pending" && selected && (
            <AdminActionForm
              action={recordDonation}
              label="Registrar y publicar"
              pendingLabel="Publicando…"
            >
              <input type="hidden" name="weekId" value={week.id} />
              <input
                type="hidden"
                name="charityId"
                value={selected.charity.id}
              />
              <h2>Registrar donación</h2>
              <p>
                Ganadora actual: <strong>{selected.charity.name}</strong>
              </p>
              <label>
                Monto (USD)
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                />
              </label>
              <label>
                Comprobante (PDF, PNG o JPEG; máx. 5 MB)
                <input
                  name="proofFile"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  required
                />
              </label>
            </AdminActionForm>
          )}
          {week.status === "donated" && (
            <>
              <h2>Semana completada</h2>
              <p>La donación y su comprobante ya están publicados.</p>
              <AdminActionForm
                action={openNextWeek}
                label="Abrir semana actual"
                pendingLabel="Abriendo…"
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
