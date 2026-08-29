import { BrandLockup } from "@/components/brand-mark";
import { ImpactCard } from "@/components/impact-card";
import { requireAdminPage } from "@/lib/admin";
import { getCurrentImpactWeek } from "@/lib/impact";

import { closeVoting, confirmRevenue, openNextWeek, recordDonation } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const access = await requireAdminPage();
  const week = await getCurrentImpactWeek();

  if (!access.configured) {
    return (
      <main className="admin-shell shell-wide">
        <header className="admin-header"><BrandLockup /><span>SETUP MODE</span></header>
        <section className="admin-title"><p className="mono-label">OPERACIONES / SIN CONEXIÓN</p><h1>Conecta Supabase para operar.</h1><p>La vista usa datos de demostración; ninguna acción destructiva está habilitada.</p></section>
        <ImpactCard week={week} compact />
        <div className="setup-grid">
          <code>NEXT_PUBLIC_SUPABASE_URL</code><code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code><code>SUPABASE_SERVICE_ROLE_KEY</code>
        </div>
      </main>
    );
  }

  const selected = week.candidates.slice().sort((a, b) => b.votes - a.votes)[0];
  return (
    <main className="admin-shell shell-wide">
      <header className="admin-header"><BrandLockup /><span>OPERACIONES / {access.user.email}</span></header>
      <section className="admin-title"><p className="mono-label">SEMANA ACTIVA</p><h1>Fondo de impacto</h1><p>Cada cambio queda registrado en el audit log.</p></section>
      <div className="admin-grid">
        <ImpactCard week={week} compact />
        <section className="operation-card">
          <p className="mono-label">SIGUIENTE ACCIÓN</p>
          {week.status === "open" && <form action={closeVoting}><input type="hidden" name="weekId" value={week.id} /><h2>Cerrar votación</h2><p>Congela la votación. Esta acción no elige automáticamente una entidad.</p><button className="button button--dark">Cerrar votación</button></form>}
          {week.status === "voting_closed" && <form action={confirmRevenue}><input type="hidden" name="weekId" value={week.id} /><h2>Confirmar ingreso</h2><label>Ingreso bruto confirmado (USD)<input name="grossRevenue" type="number" step="0.01" min="0" required /></label><button className="button button--dark">Confirmar y congelar 80/20</button></form>}
          {week.status === "donation_pending" && selected && <form action={recordDonation}><input type="hidden" name="weekId" value={week.id} /><input type="hidden" name="charityId" value={selected.charity.id} /><h2>Registrar donación</h2><p>Ganadora actual: <strong>{selected.charity.name}</strong></p><label>Monto (USD)<input name="amount" type="number" step="0.01" min="0.01" required /></label><label>URL pública del comprobante<input name="proofUrl" type="url" required /></label><button className="button button--dark">Registrar y publicar</button></form>}
          {week.status === "donated" && <><h2>Semana completada</h2><p>La donación y su comprobante ya están publicados.</p><form action={openNextWeek}><button className="button button--dark">Abrir semana actual</button></form></>}
        </section>
      </div>
    </main>
  );
}
