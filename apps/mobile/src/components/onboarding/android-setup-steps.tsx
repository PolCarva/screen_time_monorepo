import { StyleSheet, Text, View } from "react-native";

import { ANDROID_SCREENS } from "@/components/guide/android-settings-screens";
import { GuideCard } from "@/components/guide/guide-card";
import { DemoAppIcon, type DemoApp } from "@/components/onboarding/phone";
import { StoryFooter, StoryLayout } from "@/components/onboarding/story-screen";
import { PrimaryButton } from "@/components/primary-button";
import { permissionGuide, q } from "@/components/setup/android-accessibility";
import { keepAliveAction } from "@/components/setup/android-settings";
import {
  CheckRow,
  LooksDifferent,
  NumberedLine,
} from "@/components/setup/setup-bits";
import { Body } from "@/components/typography";
import { androidSys, localize } from "@/i18n";
import {
  tipsToShow,
  type AutostartState,
  type KeepAliveTarget,
  type LocalizedTip,
  type OemTip,
} from "@/lib/android-oem";
import { colors, fonts, spacing } from "@/theme/tokens";

const pick = (tip: LocalizedTip) => localize(tip.en, tip.es);
const finishLater = (onPress: () => void) => ({
  label: localize("Finish later", "Terminar después"),
  onPress,
});

/**
 * §4.3 11A — Still's Accessibility switch. Moves on only when the switch is on
 * and the service is really running; the drawn screens and the maker's usual
 * path only point the way. On but not running is its own case: the phone
 * closed Still (Xiaomi does when it is swiped off Recents) and Android keeps
 * it off until the switch goes off and on (docs/android-parity-plan.md §13).
 */
export function AccessibilityStep({
  enabled,
  running,
  restricted,
  pathTip,
  makerName,
  onOpen,
  onOpenAppInfo,
  onNext,
  onFinishLater,
}: {
  enabled: boolean;
  running: boolean;
  /** A downloaded build on Android 13+: the switch may be greyed out. */
  restricted: boolean;
  pathTip: LocalizedTip | null;
  /** A maker that closes apps in the background, or empty. */
  makerName: string;
  onOpen: () => void;
  onOpenAppInfo: () => void;
  onNext: () => void;
  onFinishLater: () => void;
}) {
  const verified = enabled && running;
  const stopped = enabled && !running;
  return (
    <StoryLayout
      body={
        verified
          ? localize(
              "Still now knows when you open one of your apps.",
              "Still ya sabe cuándo abres una de tus apps.",
            )
          : stopped
            ? localize(
                "It usually happens when the phone closes Still, for example when you swipe it off Recents. In Accessibility, turn Still off and on again: Still comes back by itself.",
                "Suele pasar cuando el teléfono cierra Still, por ejemplo al quitarlo de Recientes. En Accesibilidad, apaga Still y vuelve a encenderlo: Still vuelve solo.",
              )
            : localize(
                "That's how Still knows when you open one of your apps. Tap the button: Still comes back by itself once it's on.",
                "Así Still sabe cuándo abres una de tus apps. Toca el botón: Still vuelve solo cuando lo actives.",
              )
      }
      centerVisual={false}
      footer={
        <StoryFooter
          primary={
            verified
              ? { label: localize("Continue", "Continuar"), onPress: onNext }
              : { label: localize("Open Accessibility", "Abrir Accesibilidad"), onPress: onOpen }
          }
          secondary={verified ? undefined : finishLater(onFinishLater)}
        />
      }
      title={
        verified
          ? localize("Still is on.", "Still está activado.")
          : stopped
            ? localize("Turn Still back on.", "Vuelve a encender Still.")
            : localize("Turn on Still.", "Activa Still.")
      }
    >
      <CheckRow
        label={
          verified
            ? localize("On and running", "Activado y funcionando")
            : stopped
              ? localize(
                  "On, but Still isn't running",
                  "Activado, pero Still no está funcionando",
                )
              : localize("Not on yet", "Todavía no está activado")
        }
        state={verified ? "verified" : stopped ? "warning" : "pending"}
      />
      {stopped && makerName ? (
        <Body style={styles.noteText}>
          {localize(
            `${makerName} phones do it when Still is closed from Recents. Next, “Keep Still running” shows how to avoid it.`,
            `Los ${makerName} lo hacen al cerrar Still desde Recientes. Después, «Que Still siga activo» te muestra cómo evitarlo.`,
          )}
        </Body>
      ) : null}
      {verified ? null : (
        <>
          {permissionGuide.map((frame) => {
            const Drawn = ANDROID_SCREENS[frame.id];
            return (
              <GuideCard
                accessibilityLabel={frame.label}
                actionLabel={frame.caption}
                key={frame.id}
                onPress={onOpen}
              >
                <Drawn />
              </GuideCard>
            );
          })}
          {restricted && !enabled ? (
            <View style={styles.note}>
              <Body style={styles.noteText}>
                {localize(
                  `Is the switch greyed out? In Still's app info, open the ⋮ menu and tap ${q(androidSys("allowRestrictedSettings"))}. Then try again.`,
                  `¿El interruptor está gris? En la información de Still, abre el menú ⋮ y toca ${q(androidSys("allowRestrictedSettings"))}. Después vuelve a intentarlo.`,
                )}
              </Body>
              <PrimaryButton onPress={onOpenAppInfo} variant="secondary">
                {localize("Open Still's app info", "Abrir información de Still")}
              </PrimaryButton>
            </View>
          ) : null}
          <LooksDifferent
            lines={[
              localize(
                "The goal: Still's switch in Accessibility is on.",
                "La meta: el interruptor de Still en Accesibilidad queda activado.",
              ),
              ...(pathTip ? [pick(pathTip)] : []),
              localize(
                "It always works: search for “Still” in Settings' search bar.",
                "Siempre funciona: busca «Still» en la lupa de Ajustes.",
              ),
            ]}
          />
        </>
      )}
    </StoryLayout>
  );
}

/** §4.3 12A — the apps that get a pause; at least one, read back from the phone. */
export function AndroidAppsStep({
  apps,
  onChoose,
  onNext,
  onFinishLater,
}: {
  /** The chosen apps as the phone reports them. */
  apps: DemoApp[];
  onChoose: () => void;
  onNext: () => void;
  onFinishLater: () => void;
}) {
  const chosen = apps.length > 0;
  return (
    <StoryLayout
      body={localize(
        "The ones you open without thinking. Your most used come first. You can change them anytime.",
        "Las que abres sin pensar. Las que más usas aparecen primero. Puedes cambiarlas cuando quieras.",
      )}
      centerVisual={false}
      footer={
        <StoryFooter
          primary={
            chosen
              ? { label: localize("Continue", "Continuar"), onPress: onNext }
              : { label: localize("Choose apps", "Elegir apps"), onPress: onChoose }
          }
          secondary={
            chosen
              ? { label: localize("Change apps", "Cambiar apps"), onPress: onChoose }
              : finishLater(onFinishLater)
          }
        />
      }
      title={localize("Choose your apps.", "Elige tus apps.")}
    >
      <CheckRow
        label={
          chosen
            ? localize(
                `${apps.length} ${apps.length === 1 ? "app" : "apps"} with a pause`,
                `${apps.length} ${apps.length === 1 ? "app" : "apps"} con pausa`,
              )
            : localize("No apps yet", "Todavía no elegiste apps")
        }
        state={chosen ? "verified" : "pending"}
      />
      {chosen ? (
        <View style={styles.apps}>
          {apps.map((app) => (
            <View key={app.label} style={styles.app}>
              <DemoAppIcon app={app} size={40} />
              <Text numberOfLines={1} style={styles.appLabel}>
                {app.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </StoryLayout>
  );
}

/**
 * §4.3 13A — makers that kill background apps. Battery is read from the
 * phone, and so is Autostart on Xiaomi (android-parity-plan §15); the rest has
 * no API, so it is the user's own tick, and the live test that follows proves
 * it. Every line opens the screen where it is done.
 */
export function KeepAliveStep({
  makerName,
  tips,
  batteryOk,
  autostart,
  confirmed,
  onOpenBattery,
  onOpenTip,
  onToggleConfirmed,
  onNext,
  onFinishLater,
}: {
  makerName: string;
  tips: OemTip[];
  batteryOk: boolean;
  /** Xiaomi's Autostart as the phone reports it; other phones leave it out. */
  autostart?: AutostartState;
  confirmed: boolean;
  onOpenBattery: () => void;
  onOpenTip: (target: KeepAliveTarget) => void;
  onToggleConfirmed: () => void;
  onNext: () => void;
  onFinishLater: () => void;
}) {
  return (
    <StoryLayout
      body={localize(
        `${makerName} phones close apps in the background. If yours closes Still, the pause stops showing until you turn Still back on. These settings keep it running.`,
        `Los teléfonos ${makerName} cierran apps en segundo plano. Si el tuyo cierra Still, la pausa deja de aparecer hasta que lo vuelvas a encender. Estos ajustes lo mantienen activo.`,
      )}
      centerVisual={false}
      footer={
        <StoryFooter
          primary={{ label: localize("Continue", "Continuar"), onPress: onNext }}
          secondary={finishLater(onFinishLater)}
        />
      }
      title={localize("Keep Still running.", "Que Still siga activo.")}
    >
      <CheckRow
        label={
          batteryOk
            ? localize("Battery: not restricted", "Batería: sin restricciones")
            : localize("Battery: still restricted", "Batería: todavía con restricciones")
        }
        onPress={batteryOk ? undefined : onOpenBattery}
        state={batteryOk ? "verified" : "pending"}
      />
      {autostart === "allowed" || autostart === "denied" ? (
        <CheckRow
          label={
            autostart === "allowed"
              ? localize("Autostart: on", "Inicio automático: activado")
              : localize(
                  "Autostart: off. Without it, closing Still stops the pause",
                  "Inicio automático: desactivado. Sin él, cerrar Still apaga la pausa",
                )
          }
          onPress={autostart === "allowed" ? undefined : () => onOpenTip("autostart")}
          state={autostart === "allowed" ? "verified" : "pending"}
        />
      ) : null}
      <View style={styles.tips}>
        {tipsToShow(tips, autostart).map((tip, index) => (
          <NumberedLine
            action={keepAliveAction(tip.opens)}
            index={index + 1}
            key={tip.en}
            onPress={() => onOpenTip(tip.opens)}
          >
            {pick(tip)}
          </NumberedLine>
        ))}
      </View>
      <PrimaryButton onPress={onToggleConfirmed} variant={confirmed ? "signal" : "secondary"}>
        {confirmed
          ? localize("✓ Done in Settings", "✓ Hecho en Ajustes")
          : localize("I did it in Settings", "Ya lo hice en Ajustes")}
      </PrimaryButton>
    </StoryLayout>
  );
}

export type LiveTestState = "idle" | "waiting" | "verified" | "failed";

/** One thing to check when the test failed, and the way to its setting if it has one. */
export type SetupCheck = { label: string; onPress?: () => void; action?: string };

/**
 * §4.3 14A — the real test: open a chosen app and the pause must show, in
 * test mode, counting nothing. It is what proves every step before it.
 */
export function LiveTestStep({
  app,
  state,
  ready,
  checks,
  onTest,
  onNext,
  onFinishLater,
}: {
  app: DemoApp | null;
  state: LiveTestState;
  /** The kill switch reached the native side (nativeSynced). */
  ready: boolean;
  /** What to look at, in order, when the pause did not show; each opens its setting. */
  checks: SetupCheck[];
  onTest: () => void;
  onNext: () => void;
  onFinishLater: () => void;
}) {
  const label = app?.label ?? localize("your app", "tu app");
  const verified = state === "verified";
  return (
    <StoryLayout
      body={
        verified
          ? localize(
              `This is what you'll see every time you open ${label}.`,
              `Esto vas a ver cada vez que abras ${label}.`,
            )
          : localize(
              `Open ${label}: the pause has to show up. This test doesn't count.`,
              `Abre ${label}: la pausa tiene que aparecer. Esta prueba no cuenta.`,
            )
      }
      centerVisual={false}
      footer={
        <StoryFooter
          primary={
            verified
              ? { label: localize("Continue", "Continuar"), onPress: onNext }
              : {
                  label: ready
                    ? localize(`Open ${label}`, `Abrir ${label}`)
                    : localize("One moment…", "Un momento…"),
                  onPress: onTest,
                  disabled: !ready || !app || state === "waiting",
                }
          }
          secondary={verified ? undefined : finishLater(onFinishLater)}
        />
      }
      title={
        verified
          ? localize("It works.", "Funciona.")
          : localize("Now try it.", "Ahora pruébalo.")
      }
    >
      {app ? (
        <View style={styles.testApp}>
          <DemoAppIcon app={app} size={64} />
          <Text style={styles.testLabel}>{app.label}</Text>
        </View>
      ) : null}
      <CheckRow
        label={
          verified
            ? localize("The pause showed up", "La pausa apareció")
            : state === "waiting"
              ? localize("Waiting for the pause…", "Esperando la pausa…")
              : state === "failed"
                ? localize("The pause didn't show up.", "La pausa no apareció.")
                : localize("Not tested yet", "Todavía sin probar")
        }
        state={
          verified
            ? "verified"
            : state === "waiting"
              ? "waiting"
              : state === "failed"
                ? "warning"
                : "pending"
        }
      />
      {state === "failed" ? (
        <View style={styles.tips}>
          {checks.map((check, index) => (
            <NumberedLine
              action={check.action}
              index={index + 1}
              key={check.label}
              onPress={check.onPress}
            >
              {check.label}
            </NumberedLine>
          ))}
        </View>
      ) : null}
    </StoryLayout>
  );
}

export type SummaryLine = {
  label: string;
  verified: boolean;
  recommended: boolean;
  /** Takes the user to what is still missing; shown only while unverified. */
  onFix?: () => void;
};

/** §4.5 — everything the setup proved, and what is only recommended. */
export function DoneStep({
  lines,
  busy,
  onFinish,
}: {
  lines: SummaryLine[];
  busy: boolean;
  onFinish: () => void;
}) {
  return (
    <StoryLayout
      body={localize(
        "Still is ready to pause your apps.",
        "Still ya está listo para pausar tus apps.",
      )}
      centerVisual={false}
      footer={
        <StoryFooter
          primary={{
            label: localize("Go to Today", "Ir a Hoy"),
            onPress: onFinish,
            disabled: busy,
          }}
        />
      }
      title={localize("All set.", "Todo listo.")}
    >
      {lines.map((line) => (
        <CheckRow
          key={line.label}
          label={
            line.verified || !line.recommended
              ? line.label
              : localize(`${line.label} · recommended`, `${line.label} · recomendado`)
          }
          onPress={line.verified ? undefined : line.onFix}
          state={line.verified ? "verified" : line.recommended ? "pending" : "warning"}
        />
      ))}
    </StoryLayout>
  );
}

const styles = StyleSheet.create({
  note: { gap: spacing.sm },
  noteText: { color: colors.graphiteSoft, fontSize: 13, lineHeight: 19 },
  apps: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  app: { width: 72, alignItems: "center", gap: spacing.xs },
  appLabel: {
    maxWidth: 72,
    color: colors.graphite,
    fontFamily: fonts.brandMedium,
    fontSize: 12,
  },
  tips: { gap: spacing.sm },
  testApp: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  testLabel: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 16,
  },
});
