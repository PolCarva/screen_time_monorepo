import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { FieldApertureMark } from "@/components/field-aperture-mark";
import { CheckFill, PressableScale } from "@/components/motion";
import { PrimaryButton } from "@/components/primary-button";
import { Screen } from "@/components/screen";
import { Body, Eyebrow, Heading, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import {
  type RelativeAge,
  relativeAge,
  resolveSetupTier,
} from "@/lib/ios-shortcut-setup";
import {
  MAX_APP_NAME_LENGTH,
  type ShortcutTarget,
  activeTargets,
} from "@/lib/shortcut-targets";
import { useShortcutTargets } from "@/state/shortcut-targets";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

function ageLabel(age: RelativeAge) {
  switch (age.unit) {
    case "now":
      return localize("just now", "ahora mismo");
    case "minutes":
      return localize(`${age.value} min ago`, `hace ${age.value} min`);
    case "hours":
      return localize(`${age.value} h ago`, `hace ${age.value} h`);
    case "days":
      return localize(
        `${age.value} ${age.value === 1 ? "day" : "days"} ago`,
        `hace ${age.value} ${age.value === 1 ? "día" : "días"}`,
      );
  }
}

export default function IosAppsScreen() {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const { ready, targets, health, setSelected, addCustom } =
    useShortcutTargets();
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [customName, setCustomName] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const checkedInstalled = useRef(false);

  useEffect(() => {
    // Selecting an app produces a new list; the installed check runs once.
    if (Platform.OS !== "ios" || !ready || checkedInstalled.current) return;
    checkedInstalled.current = true;
    void (async () => {
      // iOS never lists installed apps. Asking whether a declared URL scheme
      // can be opened is the only signal, and it only covers the catalog.
      const found = await Promise.all(
        targets
          .filter((target) => target.origin === "catalog" && target.urlScheme)
          .map(async (target) =>
            (await Linking.canOpenURL(target.urlScheme!).catch(() => false))
              ? target.id
              : null,
          ),
      );
      setInstalled(new Set(found.filter((id): id is string => id !== null)));
    })();
  }, [ready, targets]);

  const sections = useMemo(() => {
    const mine = targets.filter(
      (target) => target.origin !== "catalog" && target.state !== "available",
    );
    const catalog = targets.filter((target) => target.origin === "catalog");
    const onDevice = catalog.filter(
      (target) => installed.has(target.id) || target.state === "active",
    );
    const others = catalog.filter((target) => !onDevice.includes(target));
    return { mine, onDevice, others };
  }, [installed, targets]);

  const chosen = activeTargets(targets);
  // With one automation for every app, any app is added from Shortcuts' own
  // list of installed apps. iOS never gives that list to Still.
  const pickInShortcuts =
    resolveSetupTier({ iosVersion: Platform.Version }) === "single_automation";

  async function submitCustom() {
    const result = await addCustom(customName);
    if (result.error === "empty") {
      setCustomError(
        localize("Type the app's name first.", "Escribe primero el nombre."),
      );
      return;
    }
    if (result.error === "too_long") {
      setCustomError(
        localize("That name is too long.", "Ese nombre es demasiado largo."),
      );
      return;
    }
    if (result.error === "reserved") {
      setCustomError(
        localize(
          "Still and Shortcuts cannot be paused.",
          "Still y Atajos no se pueden pausar.",
        ),
      );
      return;
    }
    if (result.error === "duplicate") {
      setCustomError(
        localize("That app is already chosen.", "Esa app ya está elegida."),
      );
      return;
    }
    setCustomName("");
    setCustomError(null);
  }

  function renderRow(target: ShortcutTarget) {
    const selected = target.state === "active";
    const entry = health[target.id];
    const age = relativeAge(entry?.lastTriggeredAt, now);
    const status = !selected
      ? null
      : age
        ? localize(
            `Connected · last pause ${ageLabel(age)}`,
            `Conectada · última pausa ${ageLabel(age)}`,
          )
        : localize("Not tested yet", "Falta probar");
    return (
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        dimTo={0.62}
        key={target.id}
        onPress={() => void setSelected(target.id, !selected)}
        scaleTo={1}
        style={styles.row}
      >
        <View style={[styles.check, selected && styles.checkOn]}>
          <CheckFill checked={selected} color={colors.graphite}>
            <Body style={styles.checkMark}>✓</Body>
          </CheckFill>
        </View>
        <View style={styles.rowCopy}>
          <Body style={styles.rowName}>{target.name}</Body>
          {status ? (
            <Body style={[styles.rowStatus, age ? styles.rowStatusOn : null]}>
              {status}
            </Body>
          ) : null}
        </View>
        {target.origin === "detected" ? (
          <Mono>{localize("FROM SHORTCUTS", "DESDE ATAJOS")}</Mono>
        ) : null}
      </PressableScale>
    );
  }

  return (
    <Screen contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.topline}>
        <FieldApertureMark size={34} />
        <Eyebrow>{localize("YOUR APPS", "TUS APPS")}</Eyebrow>
      </View>

      <View style={styles.header}>
        <Heading style={styles.title}>
          {localize(
            "Which apps do you want to open more intentionally?",
            "¿Qué apps quieres abrir con más intención?",
          )}
        </Heading>
        <Body style={styles.lede}>
          {localize(
            "Still pauses before these apps. Your choice stays on this iPhone.",
            "Still hace una pausa antes de estas apps. Tu elección se queda en este iPhone.",
          )}
        </Body>
      </View>

      {sections.mine.length > 0 ? (
        <View style={styles.section}>
          <Eyebrow>{localize("ADDED BY YOU", "AÑADIDAS POR TI")}</Eyebrow>
          {sections.mine.map(renderRow)}
        </View>
      ) : null}

      {sections.onDevice.length > 0 ? (
        <View style={styles.section}>
          <Eyebrow>{localize("ON THIS IPHONE", "EN ESTE IPHONE")}</Eyebrow>
          {sections.onDevice.map(renderRow)}
        </View>
      ) : null}

      <View style={styles.section}>
        <Eyebrow>
          {sections.onDevice.length > 0
            ? localize("MORE APPS", "MÁS APPS")
            : localize("APPS", "APPS")}
        </Eyebrow>
        {sections.others.map(renderRow)}
      </View>

      <View style={styles.section}>
        <Eyebrow>{localize("ANY OTHER APP", "CUALQUIER OTRA APP")}</Eyebrow>
        {pickInShortcuts ? (
          <View style={styles.pickCard}>
            <Body style={styles.pickTitle}>
              {localize(
                "Pick it from the apps on your iPhone",
                "Elígela entre las apps de tu iPhone",
              )}
            </Body>
            <Body style={styles.lede}>
              {localize(
                "Check your apps in Shortcuts: each one appears here by itself the first time you open it.",
                "Marca tus apps en Atajos: cada una aparece aquí sola la primera vez que la abras.",
              )}
            </Body>
            <PrimaryButton
              onPress={() =>
                router.push({
                  pathname: "/shortcut-setup",
                  params: onboarding ? { onboarding } : {},
                })
              }
              variant="secondary"
            >
              {localize("Pick from my apps", "Elegir de mis apps")}
            </PrimaryButton>
          </View>
        ) : null}
        <Body style={styles.lede}>
          {pickInShortcuts
            ? localize(
                "Or type its name exactly as it appears under its icon.",
                "O escribe su nombre tal como aparece debajo de su icono.",
              )
            : localize(
                "Type its name exactly as it appears under its icon.",
                "Escribe su nombre tal como aparece debajo de su icono.",
              )}
        </Body>
        <View style={styles.customRow}>
          <TextInput
            accessibilityLabel={localize("App name", "Nombre de la app")}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={MAX_APP_NAME_LENGTH}
            onChangeText={(value) => {
              setCustomName(value);
              setCustomError(null);
            }}
            onSubmitEditing={() => void submitCustom()}
            placeholder={localize("App name", "Nombre de la app")}
            placeholderTextColor={colors.mineralLight}
            returnKeyType="done"
            style={styles.input}
            value={customName}
          />
          <PrimaryButton
            disabled={!customName.trim()}
            onPress={() => void submitCustom()}
            variant="secondary"
          >
            {localize("Add", "Añadir")}
          </PrimaryButton>
        </View>
        {customError ? (
          <Body accessibilityLiveRegion="polite" style={styles.error}>
            {customError}
          </Body>
        ) : null}
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          disabled={chosen.length === 0 && !pickInShortcuts}
          onPress={() =>
            router.push({
              pathname: "/shortcut-setup",
              params: onboarding ? { onboarding } : {},
            })
          }
          variant="signal"
        >
          {chosen.length === 0 && pickInShortcuts
            ? localize("Continue to Shortcuts", "Continuar a Atajos")
            : chosen.length === 0
            ? localize("Choose at least one app", "Elige al menos una app")
            : localize(
                `Continue · ${chosen.length} ${chosen.length === 1 ? "app" : "apps"}`,
                `Continuar · ${chosen.length} ${chosen.length === 1 ? "app" : "apps"}`,
              )}
        </PrimaryButton>
        {onboarding ? null : (
          <PrimaryButton onPress={() => router.back()} variant="quiet">
            {localize("Done", "Listo")}
          </PrimaryButton>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { minHeight: 760, gap: spacing.xl },
  topline: {
    minHeight: 58,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  header: { gap: spacing.lg },
  title: { fontSize: 30, lineHeight: 33 },
  lede: { color: colors.graphiteSoft },
  section: { gap: spacing.sm },
  pickCard: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.chalkRaised,
  },
  pickTitle: { fontFamily: fonts.brandSemiBold, fontSize: 16 },
  row: {
    minHeight: 56,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  check: {
    width: 24,
    height: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.mineralLight,
    borderRadius: radius.sm,
  },
  checkOn: { borderColor: colors.graphite },
  checkMark: { color: colors.chalk, fontSize: 14, lineHeight: 18 },
  rowCopy: { flex: 1, gap: 2 },
  rowName: { fontFamily: fonts.brandSemiBold, fontSize: 16 },
  rowStatus: { color: colors.graphiteSoft, fontSize: 12, lineHeight: 17 },
  rowStatusOn: { color: colors.success },
  customRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.fog,
    borderRadius: radius.control,
    backgroundColor: colors.chalkRaised,
    color: colors.graphite,
    fontFamily: fonts.brandMedium,
    fontSize: 15,
  },
  error: { color: colors.danger, fontSize: 13 },
  actions: { gap: spacing.md },
});
