import * as AppleAuthentication from "expo-apple-authentication";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { localize } from "@/i18n";
import {
  identityProviderName,
  identityProviders,
  type IdentityProvider,
} from "@/lib/identity";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

type IdentityButtonsProps = {
  linked: IdentityProvider[];
  busy: IdentityProvider | null;
  onLink: (provider: IdentityProvider) => void;
};

// Apple's own button keeps Sign in with Apple within the Human Interface
// Guidelines; Google keeps Still's outlined control.
export function IdentityButtons({ linked, busy, onLink }: IdentityButtonsProps) {
  const providers = identityProviders();

  if (providers.length === 0) {
    return (
      <View
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        style={[styles.identity, styles.disabled]}
      >
        <Text style={styles.identityText}>
          {localize("G  Google coming soon", "G  Google disponible pronto")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {providers.map((provider) => {
        const isLinked = linked.includes(provider);
        const name = identityProviderName(provider);

        if (provider === "apple" && !isLinked) {
          return (
            <View
              key={provider}
              pointerEvents={busy === null ? "auto" : "none"}
              style={busy !== null && styles.disabled}
            >
              <AppleAuthentication.AppleAuthenticationButton
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                }
                cornerRadius={radius.control}
                onPress={() => onLink("apple")}
                style={styles.apple}
              />
            </View>
          );
        }

        return (
          <Pressable
            key={provider}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy !== null || isLinked }}
            disabled={busy !== null || isLinked}
            onPress={() => onLink(provider)}
            style={({ pressed }) => [
              styles.identity,
              isLinked && styles.identityLinked,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.identityText}>
              {isLinked
                ? localize(`✓  ${name} connected`, `✓  ${name} conectado`)
                : busy === provider
                  ? localize(`G  Opening ${name}…`, `G  Abriendo ${name}…`)
                  : localize(
                      `G  Continue with ${name}`,
                      `G  Continuar con ${name}`,
                    )}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  apple: { height: 52, width: "100%" },
  identity: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.graphite,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: { fontFamily: fonts.brandSemiBold, color: colors.graphite },
  identityLinked: {
    borderColor: colors.success,
    backgroundColor: colors.chalkRaised,
  },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.42 },
});
