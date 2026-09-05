import { remoteConfigSchema, type RemoteConfig } from "@screen-time/contracts";

import { BrandLockup } from "@/components/brand-mark";
import { ImpactCard, ImpactUnavailable } from "@/components/impact-card";
import { requireAdminPage } from "@/lib/admin";
import { getCurrentImpactWeek } from "@/lib/impact";
import { createAdminClient } from "@/lib/supabase";

import {
  closeVoting,
  confirmRevenue,
  createCharity,
  openNextWeek,
  publishConfig,
  recordDonation,
} from "./actions";
import { AdminActionForm } from "./admin-action-form";

export const dynamic = "force-dynamic";

function OperationalSetup({
  config,
  charities,
}: {
  config: RemoteConfig | null;
  charities: Array<{ id: string; name: string; website: string; category: string }>;
}) {
  return (
    <div className="admin-grid admin-grid--setup">
      <section className="operation-card">
        <p className="mono-label">CONFIGURACIÓN / VERSIÓN {config?.version ?? "—"}</p>
        <AdminActionForm
          action={publishConfig}
          label="Publicar configuración"
          pendingLabel="Publicando…"
        >
          <h2>Política operativa</h2>
          <p>Los valores publicados se aplican a la app y quedan auditados.</p>
          <label>
            Duración de un pase (minutos)
            <input
              defaultValue={(config?.unlockDurationSeconds ?? 600) / 60}
              max="1440"
              min="1"
              name="unlockDurationMinutes"
              required
              type="number"
            />
          </label>
          <label>
            Accesos de emergencia por día
            <input defaultValue={config?.dailyEmergencyUnlocks ?? 0} max="20" min="0" name="dailyEmergencyUnlocks" required type="number" />
          </label>
          <label>
            Anuncios recompensados por día
            <input defaultValue={config?.maxRewardedAdsPerUtcDay ?? 0} max="30" min="0" name="maxRewardedAdsPerUtcDay" required type="number" />
          </label>
          <label>
            Saldo máximo de pases
            <input defaultValue={config?.maxRewardTokenBalance ?? 0} max="20" min="0" name="maxRewardTokenBalance" required type="number" />
          </label>
          <label>
            Porcentaje destinado al fondo
            <input defaultValue={config?.impactPercentage ?? 0} max="100" min="0" name="impactPercentage" required step="0.01" type="number" />
          </label>
          <label>
            Minutos estimados por apertura evitada
            <input defaultValue={config?.estimatedMinutesPerAvoidedOpen ?? 0} max="60" min="0" name="estimatedMinutesPerAvoidedOpen" required step="0.1" type="number" />
          </label>
          <label>
            Proveedor de recompensas
            <select defaultValue={config?.rewardProvider ?? "disabled"} name="rewardProvider">
              <option value="disabled">Deshabilitado</option>
              <option value="admob">AdMob</option>
            </select>
          </label>
          <label><input defaultChecked={config?.votingEnabled ?? false} name="votingEnabled" type="checkbox" /> Votación habilitada</label>
          <label><input defaultChecked={config?.androidRestrictionEnabled ?? false} name="androidRestrictionEnabled" type="checkbox" /> Restricciones Android habilitadas</label>
        </AdminActionForm>
      </section>

      <section className="operation-card">
        <p className="mono-label">ENTIDADES / {charities.length} ACTIVAS</p>
        <AdminActionForm
          action={createCharity}
          label="Crear entidad"
          pendingLabel="Creando…"
        >
          <h2>Nueva entidad verificada</h2>
          <p>La entidad quedará disponible para la próxima semana; no se inventan candidatos.</p>
          <label>Nombre<input name="name" required maxLength={120} /></label>
          <label>Slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
          <label>Descripción<textarea name="shortDescription" required maxLength={280} /></label>
          <label>Sitio web<input name="website" required type="url" placeholder="https://" /></label>
          <label>País o alcance<input name="country" required maxLength={80} /></label>
          <label>Logo (URL opcional)<input name="logoUrl" type="url" placeholder="https://" /></label>
          <label>
            Categoría
            <select name="category" defaultValue="other">
              <option value="children">Infancia</option>
              <option value="poverty">Pobreza</option>
              <option value="environment">Ambiente</option>
              <option value="health">Salud</option>
              <option value="animals">Animales</option>
              <option value="emergencies">Emergencias</option>
              <option value="other">Otra</option>
            </select>
          </label>
        </AdminActionForm>
        {charities.length > 0 ? (
          <ul>
            {charities.map((charity) => (
              <li key={charity.id}><a href={charity.website} rel="noreferrer" target="_blank">{charity.name}</a> · {charity.category}</li>
            ))}
          </ul>
        ) : <p>No hay entidades activas.</p>}
      </section>
    </div>
  );
}

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

  const client = createAdminClient()!;
  const [configResult, charitiesResult] = await Promise.all([
    client.from("remote_config_versions").select("payload").eq("is_active", true).maybeSingle(),
    client.from("charities").select("id, name, website, category").eq("is_active", true).order("created_at"),
  ]);
  const parsedConfig = remoteConfigSchema.safeParse(configResult.data?.payload);
  const setup = (
    <OperationalSetup
      config={parsedConfig.success ? parsedConfig.data : null}
      charities={charitiesResult.data ?? []}
    />
  );

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
        {setup}
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
              label={`Confirmar y congelar ${week.impactPercentage}/${100 - week.impactPercentage}`}
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
      {setup}
    </main>
  );
}
