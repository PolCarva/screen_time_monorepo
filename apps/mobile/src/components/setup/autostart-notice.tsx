import { StyleSheet, View } from "react-native";

import { PrimaryButton } from "@/components/primary-button";
import { useOpenKeepAlive } from "@/components/setup/android-settings";
import { Body, Heading } from "@/components/typography";
import { localize } from "@/i18n";
import { AUTOSTART_NEEDED } from "@/lib/android-oem";
import { colors, spacing } from "@/theme/tokens";

/**
 * A Xiaomi with Autostart off: closing Still from Recents would stop the pause
 * until its switch goes off and on, so Still asks for it wherever it shows the
 * pause's state, with the way to the switch (docs/android-parity-plan.md §15).
 */
export function AutostartNotice() {
  const openKeepAlive = useOpenKeepAlive();
  return (
    <View style={styles.notice}>
      <Heading style={styles.title}>
        {localize(AUTOSTART_NEEDED.title.en, AUTOSTART_NEEDED.title.es)}
      </Heading>
      <Body style={styles.body}>
        {localize(AUTOSTART_NEEDED.body.en, AUTOSTART_NEEDED.body.es)}
      </Body>
      <PrimaryButton
        onPress={() => void openKeepAlive(AUTOSTART_NEEDED.opens)}
        variant="signal"
      >
        {localize(AUTOSTART_NEEDED.action.en, AUTOSTART_NEEDED.action.es)}
      </PrimaryButton>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  title: { fontSize: 24, lineHeight: 28 },
  body: { color: colors.graphiteSoft },
});
