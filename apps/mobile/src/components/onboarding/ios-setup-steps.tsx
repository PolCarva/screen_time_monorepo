import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StoryFooter, StoryLayout } from "@/components/onboarding/story-screen";
import { PrimaryButton } from "@/components/primary-button";
import { CheckRow, LooksDifferent } from "@/components/setup/setup-bits";
import { localize } from "@/i18n";
import { colors, fonts, spacing } from "@/theme/tokens";

export type NoticePermission = "undetermined" | "granted" | "denied";

/**
 * §4.4 14I — the notice the exact second a window ends. Recommended, not
 * required: the pause works without it. Read back from the phone, so a "no"
 * given earlier shows the way to Settings instead of a button that does nothing.
 */
export function NoticesStep({
  permission,
  onAsk,
  onOpenSettings,
  onNext,
}: {
  permission: NoticePermission;
  onAsk: () => void;
  onOpenSettings: () => void;
  onNext: () => void;
}) {
  const granted = permission === "granted";
  return (
    <StoryLayout
      body={localize(
        "When the time you chose is up, a notice tells you the pause is back, even with Focus on.",
        "Cuando termina el tiempo que elegiste, un aviso te dice que volvió la pausa, incluso con Concentración activada.",
      )}
      centerVisual={false}
      footer={
        <StoryFooter
          primary={
            granted
              ? { label: localize("Continue", "Continuar"), onPress: onNext }
              : permission === "denied"
                ? {
                    label: localize("Turn on in Settings", "Activar en Ajustes"),
                    onPress: onOpenSettings,
                  }
                : {
                    label: localize("Turn on notices", "Activar avisos"),
                    onPress: onAsk,
                  }
          }
          secondary={
            granted
              ? undefined
              : { label: localize("Not now", "Ahora no"), onPress: onNext }
          }
        />
      }
      title={localize(
        "We'll tell you when your time is up.",
        "Te avisamos cuando termina tu tiempo.",
      )}
    >
      <CheckRow
        label={
          granted
            ? localize("Notices on", "Avisos activados")
            : permission === "denied"
              ? localize("Notices are off in Settings", "Los avisos están desactivados en Ajustes")
              : localize("Notices not on yet", "Avisos todavía sin activar")
        }
        state={granted ? "verified" : permission === "denied" ? "warning" : "pending"}
      />
    </StoryLayout>
  );
}

/** §4.4 11I — the apps Still pauses on iPhone; at least one. */
export function IosAppsStep({
  chosen,
  picker,
  onNext,
  onFinishLater,
}: {
  chosen: number;
  /** The picker itself (components/ios/ios-app-picker). */
  picker: ReactNode;
  onNext: () => void;
  onFinishLater: () => void;
}) {
  return (
    <StoryLayout
      body={localize(
        "The ones you open without thinking. Each one gets its own ready-made “Pause” action in Shortcuts. Your choice stays on this iPhone.",
        "Las que abres sin pensar. Cada una tiene su acción «Pausar» ya lista en Atajos. Tu elección se queda en este iPhone.",
      )}
      centerVisual={false}
      footer={
        <StoryFooter
          primary={{
            label:
              chosen === 0
                ? localize("Choose at least one app", "Elige al menos una app")
                : localize(
                    `Continue · ${chosen} ${chosen === 1 ? "app" : "apps"}`,
                    `Continuar · ${chosen} ${chosen === 1 ? "app" : "apps"}`,
                  ),
            onPress: onNext,
            disabled: chosen === 0,
          }}
          secondary={{ label: localize("Finish later", "Terminar después"), onPress: onFinishLater }}
        />
      }
      title={localize("Choose your apps.", "Elige tus apps.")}
    >
      {picker}
    </StoryLayout>
  );
}

/**
 * §4.4 12I — making the automation in Shortcuts, for the next app still to
 * connect. iOS cannot read automations, so this step has no signal of its
 * own: the test that follows is what proves it (D7).
 */
export function ShortcutsStep({
  app,
  guide,
  askedToContinue,
  onNext,
  onFinishLater,
}: {
  app: string;
  /** The drawn guide (components/ios/shortcut-guide). */
  guide: ReactNode;
  /** Below iOS 26 Apple asks "Continue in Still?" when the automation runs. */
  askedToContinue: boolean;
  onNext: () => void;
  onFinishLater: () => void;
}) {
  return (
    <StoryLayout
      body={localize(
        `One automation for ${app}, with Still's action ready made: nothing to type inside it. About 30 seconds.`,
        `Una automatización para ${app}, con la acción de Still ya lista: no hay que escribir nada dentro. Unos 30 segundos.`,
      )}
      centerVisual={false}
      footer={
        <StoryFooter
          primary={{
            label: localize("Done in Shortcuts: test it", "Ya la creé: probarla"),
            onPress: onNext,
          }}
          secondary={{ label: localize("Finish later", "Terminar después"), onPress: onFinishLater }}
        />
      }
      title={localize(`Connect ${app} with Shortcuts.`, `Conecta ${app} con Atajos.`)}
    >
      {guide}
      <LooksDifferent
        lines={[
          localize(
            `The goal: an automation “When ${app} is opened” that runs Still's “Pause ${app}” by itself, without asking first.`,
            `La meta: una automatización «Cuando se abra ${app}» que ejecute «Pausar ${app}» de Still sola, sin preguntar antes.`,
          ),
          localize(
            "If a screen looks different, look for the Automation tab in Shortcuts and tap +.",
            "Si una pantalla se ve distinta, busca la pestaña Automatización en Atajos y toca +.",
          ),
          ...(askedToContinue
            ? [
                localize(
                  "When you test it, iOS will ask “Continue in Still?”: tap Continue.",
                  "Cuando la pruebes, iOS va a preguntar «¿Continuar en Still?»: toca Continuar.",
                ),
              ]
            : []),
        ]}
      />
    </StoryLayout>
  );
}

/**
 * §4.4 13I — every chosen app tested: its automation has to fire during this
 * setup. The list tests one app at a time and brings Still back here.
 */
export function AppTestsStep({
  total,
  verified,
  nextApp,
  askedToContinue,
  list,
  extra,
  onChangeApps,
  onGuide,
  onNext,
  onFinishLater,
}: {
  total: number;
  verified: number;
  /** The next app still to connect, or null when all are. */
  nextApp: string | null;
  askedToContinue: boolean;
  /** components/ios/shortcut-connect-list, fed with this setup's test. */
  list: ReactNode;
  /** Optional rows under the list (the return shortcuts). */
  extra?: ReactNode;
  onChangeApps: () => void;
  onGuide: () => void;
  onNext: () => void;
  onFinishLater: () => void;
}) {
  const done = total > 0 && verified >= total;
  return (
    <StoryLayout
      body={[
        localize(
          "An app counts once its automation runs during this test, whatever your Shortcuts screens looked like.",
          "Una app cuenta cuando su automatización se ejecuta en esta prueba, se hayan visto como se hayan visto tus pantallas de Atajos.",
        ),
        ...(askedToContinue
          ? [
              localize(
                "If iOS asks “Continue in Still?”, tap Continue.",
                "Si iOS pregunta «¿Continuar en Still?», toca Continuar.",
              ),
            ]
          : []),
      ].join(" ")}
      centerVisual={false}
      footer={
        <StoryFooter
          primary={
            done
              ? { label: localize("Continue", "Continuar"), onPress: onNext }
              : {
                  label: nextApp
                    ? localize(`How to connect ${nextApp}`, `Cómo conectar ${nextApp}`)
                    : localize("How to connect an app", "Cómo conectar una app"),
                  onPress: onGuide,
                }
          }
          secondary={
            done
              ? undefined
              : { label: localize("Finish later", "Terminar después"), onPress: onFinishLater }
          }
        />
      }
      title={
        done
          ? localize("Every app works.", "Todas tus apps funcionan.")
          : localize("Test each app.", "Prueba cada app.")
      }
    >
      <CheckRow
        label={localize(
          `${verified} of ${total} ${total === 1 ? "app" : "apps"} tested`,
          `${verified} de ${total} ${total === 1 ? "app probada" : "apps probadas"}`,
        )}
        state={done ? "verified" : verified > 0 ? "waiting" : "pending"}
      />
      {list}
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={onChangeApps}
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      >
        <Text style={styles.linkLabel}>
          {localize("Add or remove apps", "Añadir o quitar apps")}
        </Text>
      </Pressable>
      {extra}
    </StoryLayout>
  );
}

/**
 * §4.4 13I, optional — apps with no link Still can open need a shortcut named
 * `Still - <App>` to come back after the ad. Testing runs that shortcut: it
 * opens the app, and the app's automation firing proves the way back works.
 */
export function ReturnShortcutRows({
  apps,
  onCopy,
  onTest,
}: {
  apps: { id: string; name: string; shortcut: string; tested: boolean }[];
  onCopy: (shortcut: string) => void;
  onTest: (id: string) => void;
}) {
  if (apps.length === 0) return null;
  return (
    <View style={styles.returns}>
      <Text style={styles.returnsTitle}>
        {localize("Straight back after the ad (optional)", "Volver directo tras el anuncio (opcional)")}
      </Text>
      <Text style={styles.returnsBody}>
        {localize(
          "For these apps, a shortcut with that exact name and one “Open App” action lets Still reopen them. Without it you open them from the Home Screen.",
          "Para estas apps, un atajo con ese nombre exacto y una acción «Abrir app» deja que Still las reabra. Sin él, las abres desde la pantalla de inicio.",
        )}
      </Text>
      {apps.map((app) => (
        <View key={app.id} style={styles.returnRow}>
          <View style={styles.returnCopy}>
            <Text style={styles.returnName}>{app.name}</Text>
            <Text style={styles.returnShortcut}>{app.shortcut}</Text>
            <CheckRow
              label={
                app.tested
                  ? localize("Comes back directly", "Vuelve directo")
                  : localize("Not tested", "Sin probar")
              }
              state={app.tested ? "verified" : "pending"}
            />
          </View>
          <View style={styles.returnActions}>
            <PrimaryButton onPress={() => onCopy(app.shortcut)} variant="quiet">
              {localize("Copy name", "Copiar nombre")}
            </PrimaryButton>
            <PrimaryButton onPress={() => onTest(app.id)} variant="secondary">
              {localize("Test the way back", "Probar volver")}
            </PrimaryButton>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: "flex-start", paddingVertical: spacing.xs },
  linkLabel: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 14,
    textDecorationLine: "underline",
    textDecorationColor: colors.mineralLight,
  },
  pressed: { opacity: 0.5 },
  returns: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  returnsTitle: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 16,
  },
  returnsBody: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brand,
    fontSize: 13,
    lineHeight: 19,
  },
  returnRow: { gap: spacing.sm, paddingVertical: spacing.sm },
  returnCopy: { gap: spacing.xs },
  returnName: { color: colors.graphite, fontFamily: fonts.brandSemiBold, fontSize: 15 },
  returnShortcut: { color: colors.graphiteSoft, fontFamily: fonts.mono, fontSize: 13 },
  returnActions: { flexDirection: "row", gap: spacing.sm },
});
