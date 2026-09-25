import { StyleSheet, Text, View } from "react-native";

import { CheckFill, PressableScale } from "@/components/motion";
import {
  StoryFooter,
  StoryLayout,
  useStoryMetrics,
} from "@/components/onboarding/story-screen";
import { CheckRow } from "@/components/setup/setup-bits";
import { Body } from "@/components/typography";
import { localize } from "@/i18n";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

/** §4.1 — the age check the ads need; self-declared, there is nothing to read. */
export function AdultStep({
  confirmed,
  ready,
  onToggle,
  onNext,
}: {
  confirmed: boolean;
  /** The config has arrived, so the next step knows whether pauses are on. */
  ready: boolean;
  onToggle: () => void;
  onNext: () => void;
}) {
  const { compact } = useStoryMetrics();
  return (
    <StoryLayout
      body={localize(
        "Still is funded by ads, so we ask you to confirm it.",
        "Still se financia con anuncios, así que te pedimos confirmarlo.",
      )}
      centerVisual={false}
      footer={
        <StoryFooter
          primary={{
            label: ready
              ? localize("Continue", "Continuar")
              : localize("One moment…", "Un momento…"),
            onPress: onNext,
            disabled: !confirmed || !ready,
          }}
        />
      }
      title={localize("For adults only.", "Solo para mayores de 18.")}
    >
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        onPress={onToggle}
        scaleTo={0.985}
        style={[styles.checkRow, compact && styles.checkRowCompact]}
      >
        <View style={[styles.check, confirmed && styles.checkOn]}>
          <CheckFill checked={confirmed} color={colors.mineral}>
            <Text style={styles.tick}>✓</Text>
          </CheckFill>
        </View>
        <Body style={styles.checkLabel}>
          {localize(
            "I confirm that I am 18 or older.",
            "Confirmo que tengo 18 años o más.",
          )}
        </Body>
      </PressableScale>
    </StoryLayout>
  );
}

/**
 * §4.2 — Google's consent for ads, only where Google requires it (D12). The
 * form is Google's; the step moves on once it has an answer, whatever it is.
 */
export function AdsConsentStep({
  state,
  onAsk,
  onNext,
}: {
  /** "checking" while UMP answers; "ready" to ask; "answered" once chosen. */
  state: "checking" | "ready" | "answered";
  onAsk: () => void;
  onNext: () => void;
}) {
  return (
    <StoryLayout
      body={localize(
        "Where you live, Google asks you to choose how your data is used for ads. It takes a moment, and you can change it later in Settings.",
        "Donde vives, Google pide que elijas cómo se usan tus datos para los anuncios. Tarda un momento y puedes cambiarlo después en Ajustes.",
      )}
      footer={
        <StoryFooter
          primary={
            state === "answered"
              ? { label: localize("Continue", "Continuar"), onPress: onNext }
              : {
                  label:
                    state === "checking"
                      ? localize("One moment…", "Un momento…")
                      : localize("Choose", "Elegir"),
                  onPress: onAsk,
                  disabled: state === "checking",
                }
          }
        />
      }
      title={localize("Your ads, your choice.", "Tus anuncios, tu elección.")}
    >
      {state === "answered" ? (
        <CheckRow
          label={localize("Your choice is saved", "Tu elección quedó guardada")}
          state="verified"
        />
      ) : null}
    </StoryLayout>
  );
}

/** The kill switch is off: finish now, Still guides the setup when pauses return. */
export function PausesOffStep({
  busy,
  onFinish,
}: {
  busy: boolean;
  onFinish: () => void;
}) {
  return (
    <StoryLayout
      body={localize(
        "Finish now; when they're back, Still walks you through turning them on.",
        "Termina ahora; cuando vuelvan, Still te guía para activarlas.",
      )}
      footer={
        <StoryFooter
          primary={{
            label: localize("Finish setup", "Terminar configuración"),
            onPress: onFinish,
            disabled: busy,
          }}
        />
      }
      title={localize("Pauses are coming back soon.", "Las pausas vuelven pronto.")}
    />
  );
}

const styles = StyleSheet.create({
  checkRow: {
    minHeight: 68,
    padding: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.mineralLight,
    borderRadius: radius.control,
  },
  checkRowCompact: { minHeight: 58, paddingVertical: spacing.sm },
  check: {
    width: 28,
    height: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.graphite,
    borderRadius: radius.sm,
  },
  checkOn: { borderColor: colors.mineral },
  tick: { color: colors.chalk, fontFamily: fonts.brandBold },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20 },
});
