import type { ReactNode } from "react";

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

function SectionHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="admin-section__head">
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
    </header>
  );
}

function PendingWeeks({ weeks }: { weeks: OperatorWeek[] }) {
  return (
    <section className="admin-section" id="pendientes">
      <SectionHead title="Semanas por cerrar">
        Confirma el ingreso de cada semana cerrada y después registra la
        donación con su comprobante.
      </SectionHead>
      {weeks.length === 0 ? (
        <p className="admin-empty">No hay nada pendiente. Todo al día.</p>
      ) : (
        <div className="admin-grid">
          {weeks.map((week) => (
            <article className="operation-card" key={week.id}>
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
                  <h3>Paso 1 · Confirmar ingreso</h3>
                  <dl className="admin-summary">
                    <div>
                      <dt>Estimado hoy</dt>
                      <dd>{formatFund(week.totals.grossRevenueMinor)}</dd>
                    </div>
                    <div>
                      <dt>Según AdMob</dt>
                      <dd>{formatFund(week.totals.reportedRevenueMinor)}</dd>
                    </div>
                    <div>
                      <dt>Aún sin informar</dt>
                      <dd>{formatFund(week.totals.estimatedRevenueMinor)}</dd>
                    </div>
                    <div>
                      <dt>Anuncios · personas</dt>
                      <dd>
                        {week.totals.rewardedAds} · {week.totals.participants}
                      </dd>
                    </div>
                  </dl>
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
                  <h3>Paso 2 · Registrar donación</h3>
                  <dl className="admin-summary">
                    <div>
                      <dt>Ganadora</dt>
                      <dd>{week.winner.name}</dd>
                    </div>
                    <div>
                      <dt>Fondo</dt>
                      <dd>{formatFund(week.totals.impactFundMinor)}</dd>
                    </div>
                  </dl>
                  <div className="admin-fields">
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
                      Comprobante
                      <input
                        accept="application/pdf,image/png,image/jpeg"
                        name="proofFile"
                        required
                        type="file"
                      />
                      <span className="admin-hint">PDF, PNG o JPEG · máx. 5 MB</span>
                    </label>
                  </div>
                </AdminActionForm>
              ) : (
                <p>La semana no tiene proyectos para elegir una ganadora.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentAds({ views }: { views: RecentAdView[] }) {
  return (
    <section className="admin-section" id="anuncios">
      <SectionHead title="Anuncios recientes">
        Cada anuncio, con lo que se estima que generó.
      </SectionHead>
      <div className="operation-card admin-ads">
        {views.length === 0 ? (
          <p>Todavía no hay anuncios confirmados por AdMob.</p>
        ) : (
          <div className="admin-table">
            <table>
              <thead>
                <tr>
                  <th>Momento (UTC)</th>
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
                    <td>
                      <span
                        className={`admin-pill ${view.verified ? "admin-pill--ok" : "admin-pill--pending"}`}
                      >
                        {view.verified ? "Confirmado" : "Pendiente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export const dynamic = "force-dynamic";

const CATEGORIES: Record<string, string> = {
  children: "Infancia",
  poverty: "Pobreza",
  environment: "Ambiente",
  health: "Salud",
  animals: "Animales",
  emergencies: "Emergencias",
  other: "Otra",
};

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="admin-toggle">
      {label}
      <input defaultChecked={checked} name={name} type="checkbox" role="switch" />
    </label>
  );
}

function OperationalSetup({
  config,
  charities,
}: {
  config: RemoteConfig | null;
  charities: Array<{ id: string; name: string; website: string; category: string }>;
}) {
  return (
    <>
      <section className="admin-section" id="configuracion">
        <SectionHead title="Configuración">
          Versión activa {config?.version ?? "—"}. Los valores publicados se
          aplican a la app y quedan auditados.
        </SectionHead>
        <div className="operation-card">
          <AdminActionForm
            action={publishConfig}
            label="Publicar configuración"
            pendingLabel="Publicando…"
          >
            <div className="admin-fields">
              <label>
                Duración por defecto de una entrada
                <input defaultValue={(config?.unlockDurationSeconds ?? 600) / 60} max="1440" min="1" name="unlockDurationMinutes" required type="number" />
                <span className="admin-hint">Minutos (1–1440)</span>
              </label>
              {/* Ads have no limit and passes are gone, but builds published
                  before that still read both values, so they are republished
                  as they are (docs/ads-only-pause-plan.md, D12). */}
              <input name="maxRewardedAdsPerUtcDay" type="hidden" value={config?.maxRewardedAdsPerUtcDay ?? 10} />
              <input name="maxRewardTokenBalance" type="hidden" value={config?.maxRewardTokenBalance ?? 3} />
              <label>
                Porcentaje destinado al fondo
                <input defaultValue={config?.impactPercentage ?? 0} max="100" min="0" name="impactPercentage" required step="0.01" type="number" />
                <span className="admin-hint">% del ingreso bruto</span>
              </label>
              <label>
                Minutos por apertura evitada
                <input defaultValue={config?.estimatedMinutesPerAvoidedOpen ?? 0} max="60" min="0" name="estimatedMinutesPerAvoidedOpen" required step="0.1" type="number" />
                <span className="admin-hint">Estimación para el tiempo recuperado</span>
              </label>
              <label>
                eCPM estimado
                <input defaultValue={config?.estimatedRewardedEcpmUsd ?? 3} max="200" min="0" name="estimatedRewardedEcpmUsd" required step="0.01" type="number" />
                <span className="admin-hint">USD por 1000 anuncios recompensados</span>
              </label>
              <label>
                Proveedor de recompensas
                <select defaultValue={config?.rewardProvider ?? "disabled"} name="rewardProvider">
                  <option value="disabled">Deshabilitado</option>
                  <option value="admob">AdMob</option>
                </select>
              </label>
            </div>
            <fieldset className="admin-toggles">
              <legend>Funciones</legend>
              <Toggle name="votingEnabled" label="Votación habilitada" checked={config?.votingEnabled ?? false} />
              <Toggle name="androidRestrictionEnabled" label="Restricciones Android habilitadas" checked={config?.androidRestrictionEnabled ?? false} />
              <Toggle name="iosRestrictionEnabled" label="Pausas iOS (Atajos) habilitadas" checked={config?.iosRestrictionEnabled ?? false} />
              <Toggle name="iosHomeOnCancelEnabled" label="iOS hasta 0.3.0: salir al inicio con «Ya no quiero entrar» (usa una API privada; dejar apagado, sin efecto desde 0.3.1)" checked={config?.iosHomeOnCancelEnabled ?? false} />
            </fieldset>
          </AdminActionForm>
        </div>
      </section>

      <section className="admin-section" id="entidades">
        <SectionHead title="Entidades">
          {charities.length} activas. Una entidad nueva queda disponible para la
          próxima semana; no se inventan candidatos.
        </SectionHead>
        <div className="admin-grid">
          <div className="operation-card">
            <p className="mono-label">ACTIVAS</p>
            {charities.length > 0 ? (
              <ul className="admin-list">
                {charities.map((charity) => (
                  <li key={charity.id}>
                    <a href={charity.website} rel="noreferrer" target="_blank">{charity.name}</a>
                    <span className="admin-hint">{CATEGORIES[charity.category] ?? charity.category}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No hay entidades activas.</p>
            )}
          </div>
          <div className="operation-card">
            <p className="mono-label">NUEVA ENTIDAD VERIFICADA</p>
            <AdminActionForm action={createCharity} label="Crear entidad" pendingLabel="Creando…">
              <div className="admin-fields">
                <label>Nombre<input name="name" required maxLength={120} /></label>
                <label>
                  Slug
                  <input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="mi-entidad" />
                </label>
              </div>
              <label>Descripción<textarea name="shortDescription" required maxLength={280} /></label>
              <div className="admin-fields">
                <label>Sitio web<input name="website" required type="url" placeholder="https://" /></label>
                <label>País o alcance<input name="country" required maxLength={80} /></label>
                <label>Logo (URL opcional)<input name="logoUrl" type="url" placeholder="https://" /></label>
                <label>
                  Categoría
                  <select name="category" defaultValue="other">
                    {Object.entries(CATEGORIES).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </AdminActionForm>
          </div>
        </div>
      </section>
    </>
  );
}

function AdminHeader({ email }: { email?: string }) {
  return (
    <header className="admin-header">
      <BrandLockup />
      {email ? (
        <span className="admin-header__session">
          <span className="admin-badge">OPERACIONES</span>
          <span className="admin-email">{email}</span>
          <form action={signOutAdmin}>
            <button type="submit">Cerrar sesión</button>
          </form>
        </span>
      ) : (
        <span className="admin-badge">SETUP MODE</span>
      )}
    </header>
  );
}

function AdminNav({ pending }: { pending: number }) {
  return (
    <nav className="admin-nav" aria-label="Secciones">
      <a href="#semana">Esta semana</a>
      <a href="#pendientes">
        Por cerrar{pending > 0 ? <span>{pending}</span> : null}
      </a>
      <a href="#anuncios">Anuncios</a>
      <a href="#configuracion">Configuración</a>
      <a href="#entidades">Entidades</a>
    </nav>
  );
}

export default async function AdminPage() {
  const access = await requireAdminPage();

  if (!access.configured) {
    return (
      <main className="admin-shell">
        <AdminHeader />
        <section className="admin-title">
          <p className="mono-label">OPERACIONES / SIN CONEXIÓN</p>
          <h1>Conecta Supabase para operar</h1>
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
      <main className="admin-shell">
        <AdminHeader email={access.user.email} />
        <section className="admin-title">
          <p className="mono-label">PANEL DE OPERACIONES</p>
          <h1>Fondo de impacto</h1>
          <p>Las cifras se publican solamente cuando existe un registro real.</p>
        </section>
        <AdminNav pending={pendingWeeks.length} />
        <section className="admin-section" id="semana">
          <SectionHead title="Esta semana" />
          <div className="admin-grid">
            <ImpactUnavailable state={result.state} compact />
            {result.state === "empty" && (
              <div className="operation-card">
                <p className="mono-label">SIGUIENTE ACCIÓN</p>
                <AdminActionForm
                  action={openCurrentWeek}
                  label="Abrir semana actual"
                  pendingLabel="Abriendo…"
                >
                  <h3>La semana se abre sola</h3>
                  <p>
                    Cada lunes se abre la semana con la configuración vigente y
                    los proyectos de la anterior. Hace falta una configuración
                    publicada y al menos una entidad activa.
                  </p>
                </AdminActionForm>
              </div>
            )}
          </div>
        </section>
        <PendingWeeks weeks={pendingWeeks} />
        {setup}
      </main>
    );
  }

  const week = result.week;
  return (
    <main className="admin-shell">
      <AdminHeader email={access.user.email} />
      <section className="admin-title">
        <p className="mono-label">PANEL DE OPERACIONES</p>
        <h1>Fondo de impacto</h1>
        <p>
          Las semanas se abren y cierran su votación solas. Confirmar el
          ingreso y registrar la donación sigue siendo manual y queda en el
          audit log.
        </p>
      </section>
      <AdminNav pending={pendingWeeks.length} />
      <section className="admin-section" id="semana">
        <SectionHead title="Esta semana" />
        <div className="admin-grid">
          <ImpactCard week={week} compact />
          <div className="operation-card">
            <p className="mono-label">VOTACIÓN</p>
            {week.status === "open" ? (
              <AdminActionForm
                action={closeVoting}
                label="Cerrar votación ahora"
                pendingLabel="Cerrando…"
              >
                <input type="hidden" name="weekId" value={week.id} />
                <h3>Abierta</h3>
                <p>
                  Se cierra sola el domingo. Ciérrala antes solo si hace falta;
                  esta acción no elige automáticamente una entidad.
                </p>
              </AdminActionForm>
            ) : (
              <>
                <h3>Cerrada</h3>
                <p>Sus acciones pendientes aparecen en «Semanas por cerrar».</p>
              </>
            )}
          </div>
        </div>
      </section>
      <PendingWeeks weeks={pendingWeeks} />
      <RecentAds views={recentAds} />
      {setup}
    </main>
  );
}
