import { remoteConfigSchema, type RemoteConfig } from "@screen-time/contracts";

import { BrandLockup } from "@/components/brand-mark";
import {
  ImpactCard,
  ImpactUnavailable,
  formatFund,
} from "@/components/impact-card";
import { requireAdminPage } from "@/lib/admin";
import {
  type OperatorWeek,
  type RecentAdView,
  getCurrentImpactWeek,
  getRecentAdViews,
  getWeeksAwaitingOperator,
} from "@/lib/impact";
import { createAdminClient } from "@/lib/supabase";

import {
  closeVoting,
  confirmRevenue,
  createCharity,
  openCurrentWeek,
  publishConfig,
  recordDonation,
} from "./actions";
import { AdminActionForm } from "./admin-action-form";
import { signOutAdmin } from "./login/actions";

const ESTIMATE_SOURCES: Record<RecentAdView["estimateSource"], string> = {
  paid_event: "Valor del SDK",
  observed_ecpm: "eCPM observado",
  default_ecpm: "eCPM por defecto",
  test_ad: "Anuncio de prueba",
};

function usdFromMicros(micros: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(micros / 1_000_000);
}

function PendingWeeks({ weeks }: { weeks: OperatorWeek[] }) {
  if (weeks.length === 0) return null;
  return (
    <section className="admin-pending">
      <p className="mono-label">SEMANAS POR CERRAR / {weeks.length}</p>
      <div className="admin-grid">
        {weeks.map((week) => (
          <section className="operation-card" key={week.id}>
            <p className="mono-label">
              {week.weekStart} — {week.weekEnd}
            </p>
            {week.status === "voting_closed" ? (
              <AdminActionForm
                action={confirmRevenue}
                label={`Confirmar y congelar ${week.impactPercentage}/${100 - week.impactPercentage}`}
                pendingLabel="Confirmando…"
              >
                <input type="hidden" name="weekId" value={week.id} />
                <h2>Confirmar ingreso</h2>
                <p>
                  Estimado hoy: {formatFund(week.totals.grossRevenueMinor)} (
                  {formatFund(week.totals.reportedRevenueMinor)} según AdMob,{" "}
                  {formatFund(week.totals.estimatedRevenueMinor)} por anuncios
                  que AdMob aún no informó) · {week.totals.rewardedAds}{" "}
                  anuncios de {week.totals.participants} personas.
                </p>
                <label>
                  Ingreso bruto confirmado (USD)
                  <input
                    defaultValue={(week.totals.grossRevenueMinor / 100).toFixed(2)}
                    min="0"
                    name="grossRevenue"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>
              </AdminActionForm>
            ) : week.winner ? (
              <AdminActionForm
                action={recordDonation}
                label="Registrar y publicar"
                pendingLabel="Publicando…"
              >
                <input type="hidden" name="weekId" value={week.id} />
                <input type="hidden" name="charityId" value={week.winner.id} />
                <h2>Registrar donación</h2>
                <p>
                  Ganadora: <strong>{week.winner.name}</strong> · fondo{" "}
                  {formatFund(week.totals.impactFundMinor)}
                </p>
                <label>
                  Monto (USD)
                  <input
                    defaultValue={(week.totals.impactFundMinor / 100).toFixed(2)}
                    min="0.01"
                    name="amount"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>
                <label>
                  Comprobante (PDF, PNG o JPEG; máx. 5 MB)
                  <input
                    accept="application/pdf,image/png,image/jpeg"
                    name="proofFile"
                    required
                    type="file"
                  />
                </label>
              </AdminActionForm>
            ) : (
              <p>La semana no tiene proyectos para elegir una ganadora.</p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}

function RecentAds({ views }: { views: RecentAdView[] }) {
  return (
    <section className="operation-card admin-ads">
      <p className="mono-label">ANUNCIOS RECIENTES / VALOR ESTIMADO</p>
      <h2>Cada anuncio, con lo que se estima que generó</h2>
      {views.length === 0 ? (
        <p>Todavía no hay anuncios confirmados por AdMob.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Momento</th>
              <th>Plataforma</th>
              <th>Valor</th>
              <th>Origen</th>
              <th>AdMob</th>
            </tr>
          </thead>
          <tbody>
            {views.map((view, index) => (
              <tr key={`${view.viewedAt}:${index}`}>
                <td>{view.viewedAt.slice(0, 16).replace("T", " ")}</td>
                <td>{view.platform ?? "—"}</td>
                <td>{usdFromMicros(view.estimatedValueMicros)}</td>
                <td>{ESTIMATE_SOURCES[view.estimateSource]}</td>
                <td>{view.verified ? "Confirmado" : "Pendiente"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

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
            eCPM estimado de anuncios recompensados (USD por 1000)
            <input defaultValue={config?.estimatedRewardedEcpmUsd ?? 3} max="200" min="0" name="estimatedRewardedEcpmUsd" required step="0.01" type="number" />
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
          <label><input defaultChecked={config?.iosRestrictionEnabled ?? false} name="iosRestrictionEnabled" type="checkbox" /> Pausas iOS (Atajos) habilitadas</label>
          <label><input defaultChecked={config?.iosHomeOnCancelEnabled ?? false} name="iosHomeOnCancelEnabled" type="checkbox" /> iOS: salir a la pantalla de inicio al elegir «Ya no quiero entrar»</label>
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
  // The current week is ensured first, so the weeks it closes show up below.
  const result = await getCurrentImpactWeek();
  const [configResult, charitiesResult, pendingWeeks, recentAds] = await Promise.all([
    client.from("remote_config_versions").select("payload").eq("is_active", true).maybeSingle(),
    client.from("charities").select("id, name, website, category").eq("is_active", true).order("created_at"),
    getWeeksAwaitingOperator(),
    getRecentAdViews(),
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
          <span className="admin-header__session">
            OPERACIONES / {access.user.email}
            <form action={signOutAdmin}>
              <button className="text-link" type="submit">
                Cerrar sesión
              </button>
            </form>
          </span>
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
                action={openCurrentWeek}
                label="Abrir semana actual"
                pendingLabel="Abriendo…"
              >
                <h2>La semana se abre sola</h2>
                <p>
                  Cada lunes se abre la semana con la configuración vigente y
                  los proyectos de la anterior. Hace falta una configuración
                  publicada y al menos una entidad activa.
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
  return (
    <main className="admin-shell shell-wide">
      <header className="admin-header">
        <BrandLockup />
        <span className="admin-header__session">
          OPERACIONES / {access.user.email}
          <form action={signOutAdmin}>
            <button className="text-link" type="submit">
              Cerrar sesión
            </button>
          </form>
        </span>
      </header>
      <section className="admin-title">
        <p className="mono-label">SEMANA ACTIVA</p>
        <h1>Fondo de impacto</h1>
        <p>
          Las semanas se abren y cierran su votación solas. Confirmar el
          ingreso y registrar la donación sigue siendo manual y queda en el
          audit log.
        </p>
      </section>
      <div className="admin-grid">
        <ImpactCard week={week} compact />
        <section className="operation-card">
          <p className="mono-label">ESTA SEMANA</p>
          {week.status === "open" ? (
            <AdminActionForm
              action={closeVoting}
              label="Cerrar votación ahora"
              pendingLabel="Cerrando…"
            >
              <input type="hidden" name="weekId" value={week.id} />
              <h2>Votación abierta</h2>
              <p>
                Se cierra sola el domingo. Ciérrala antes solo si hace falta;
                esta acción no elige automáticamente una entidad.
              </p>
            </AdminActionForm>
          ) : (
            <>
              <h2>Votación cerrada</h2>
              <p>Sus acciones pendientes aparecen en «Semanas por cerrar».</p>
            </>
          )}
        </section>
      </div>
      <PendingWeeks weeks={pendingWeeks} />
      <RecentAds views={recentAds} />
      {setup}
    </main>
  );
}
