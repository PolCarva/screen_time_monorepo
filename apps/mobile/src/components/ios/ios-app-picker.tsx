import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform, StyleSheet, TextInput, View } from "react-native";

import { CheckFill, PressableScale } from "@/components/motion";
import { Body, Eyebrow, Mono } from "@/components/typography";
import { localize } from "@/i18n";
import { pickerSections, searchTargets } from "@/lib/ios-app-picker";
import { MAX_APP_NAME_LENGTH, type ShortcutTarget } from "@/lib/shortcut-targets";
import { useShortcutTargets } from "@/state/shortcut-targets";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

/**
 * Which catalog apps are on this iPhone. iOS never lists installed apps; asking
 * whether a declared URL scheme opens is the only signal, and it only covers
 * the catalog. Runs once: selecting an app produces a new list.
 */
function useInstalledCatalogApps(ready: boolean, targets: readonly ShortcutTarget[]) {
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const checked = useRef(false);
  useEffect(() => {
    if (Platform.OS !== "ios" || !ready || checked.current) return;
    checked.current = true;
    void (async () => {
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
  return installed;
}

function addError(error: string) {
  switch (error) {
    case "too_long":
      return localize("That name is too long.", "Ese nombre es demasiado largo.");
    case "reserved":
      return localize(
        "Still and Shortcuts cannot be paused.",
        "Still y Atajos no se pueden pausar.",
      );
    default:
      return localize("Type the app's name first.", "Escribe primero el nombre.");
  }
}

/**
 * Choosing the apps Still pauses on iOS. Each chosen app becomes a ready-made
 * "Pause <App>" action in Shortcuts, its own row to connect and test, and the
 * way Still reopens it. Search first, then the likely picks as chips, so the
 * whole list never has to be scrolled.
 */
export function IosAppPicker() {
  const { ready, targets, setSelected, addCustom } = useShortcutTargets();
  const installed = useInstalledCatalogApps(ready, targets);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Taken once the list has loaded, so sections stay put while choosing.
  const [chosenBefore, setChosenBefore] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (ready && !chosenBefore)
      setChosenBefore(
        new Set(targets.filter((target) => target.state === "active").map((target) => target.id)),
      );
  }, [chosenBefore, ready, targets]);
  const sections = useMemo(
    () => pickerSections(targets, { installed, chosenBefore: chosenBefore ?? new Set() }),
    [chosenBefore, installed, targets],
  );
  const search = useMemo(() => searchTargets(targets, query), [query, targets]);
  const searching = query.trim().length > 0;

  async function add(name: string) {
    const result = await addCustom(name);
    if (result.error && result.error !== "duplicate") {
      setError(addError(result.error));
      return;
    }
    setQuery("");
    setError(null);
  }

  function chips(list: readonly ShortcutTarget[]) {
    return (
      <View style={styles.chips}>
        {list.map((target) => (
          <AppChip
            key={target.id}
            onToggle={() => void setSelected(target.id, target.state !== "active")}
            target={target}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.searchBox}>
        <TextInput
          accessibilityLabel={localize("Search or add an app", "Busca o añade una app")}
          autoCapitalize="words"
          autoCorrect={false}
          clearButtonMode="while-editing"
          maxLength={MAX_APP_NAME_LENGTH}
          onChangeText={(value) => {
            setQuery(value);
            setError(null);
          }}
          onSubmitEditing={() => {
            if (search.addable) void add(search.addable);
          }}
          placeholder={localize("Search or add an app", "Busca o añade una app")}
          placeholderTextColor={colors.mineralLight}
          returnKeyType={search.addable ? "done" : "search"}
          style={styles.search}
          value={query}
        />
      </View>
      {error ? (
        <Body accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Body>
      ) : null}

      {searching ? (
        <View style={styles.section}>
          {search.matches.length > 0 ? chips(search.matches) : null}
          {search.addable ? (
            <PressableScale
              accessibilityRole="button"
              dimTo={0.62}
              onPress={() => void add(search.addable!)}
              scaleTo={0.985}
              style={styles.addRow}
            >
              <Body style={styles.addPlus}>+</Body>
              <View style={styles.addCopy}>
                <Body style={styles.addTitle}>
                  {localize(`Add “${search.addable}”`, `Añadir «${search.addable}»`)}
                </Body>
                <Body style={styles.hint}>
                  {localize(
                    "Any app works: you'll pick it from the real list in Shortcuts.",
                    "Sirve cualquier app: la vas a marcar en la lista real de Atajos.",
                  )}
                </Body>
              </View>
            </PressableScale>
          ) : null}
        </View>
      ) : (
        <>
          {sections.chosen.length > 0 ? (
            <View style={styles.section}>
              <Eyebrow>{localize("CHOSEN", "ELEGIDAS")}</Eyebrow>
              {chips(sections.chosen)}
            </View>
          ) : null}
          {sections.mine.length > 0 ? (
            <View style={styles.section}>
              <Eyebrow>{localize("ADDED BY YOU", "AÑADIDAS POR TI")}</Eyebrow>
              {chips(sections.mine)}
            </View>
          ) : null}
          {sections.onDevice.length > 0 ? (
            <View style={styles.section}>
              <Eyebrow>{localize("ON THIS IPHONE", "EN ESTE IPHONE")}</Eyebrow>
              {chips(sections.onDevice)}
            </View>
          ) : null}
          {sections.popular.length > 0 ? (
            <View style={styles.section}>
              <Eyebrow>{localize("POPULAR", "LAS MÁS COMUNES")}</Eyebrow>
              {chips(sections.popular)}
            </View>
          ) : null}
          <View style={styles.section}>
            {showAll ? (
              <>
                <Eyebrow>{localize("MORE APPS", "MÁS APPS")}</Eyebrow>
                {chips(sections.more)}
              </>
            ) : (
              <PressableScale
                accessibilityRole="button"
                dimTo={0.62}
                onPress={() => setShowAll(true)}
                scaleTo={1}
                style={styles.moreRow}
              >
                <Body style={styles.moreLabel}>
                  {localize(
                    `See ${sections.more.length} more apps`,
                    `Ver ${sections.more.length} apps más`,
                  )}
                </Body>
                <Mono>↓</Mono>
              </PressableScale>
            )}
            <Body style={styles.hint}>
              {localize(
                "Not listed? Type its name in the search box.",
                "¿No está? Escribe su nombre en el buscador.",
              )}
            </Body>
          </View>
        </>
      )}
    </View>
  );
}

function AppChip({ target, onToggle }: { target: ShortcutTarget; onToggle: () => void }) {
  const selected = target.state === "active";
  return (
    <PressableScale
      accessibilityLabel={target.name}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      dimTo={0.7}
      onPress={onToggle}
      scaleTo={0.96}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <View style={[styles.chipCheck, selected && styles.chipCheckOn]}>
        <CheckFill checked={selected} color={colors.chalk}>
          <Body style={styles.chipTick}>✓</Body>
        </CheckFill>
      </View>
      <Body numberOfLines={1} style={[styles.chipLabel, selected && styles.chipLabelOn]}>
        {target.name}
      </Body>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  searchBox: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.fog,
    borderRadius: radius.control,
    backgroundColor: colors.chalkRaised,
    justifyContent: "center",
  },
  search: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    color: colors.graphite,
    fontFamily: fonts.brandMedium,
    fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 13 },
  section: { gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    minHeight: 44,
    maxWidth: "100%",
    paddingLeft: spacing.xs + 2,
    paddingRight: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.fog,
    borderRadius: radius.pill,
    backgroundColor: colors.chalkRaised,
  },
  chipOn: { borderColor: colors.graphite, backgroundColor: colors.graphite },
  chipCheck: {
    width: 22,
    height: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.mineralLight,
    borderRadius: radius.pill,
  },
  chipCheckOn: { borderColor: colors.chalk },
  chipTick: { color: colors.graphite, fontSize: 13, lineHeight: 20, textAlign: "center" },
  chipLabel: { flexShrink: 1, fontFamily: fonts.brandSemiBold, fontSize: 15 },
  chipLabelOn: { color: colors.chalk },
  addRow: {
    minHeight: 64,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.mineralLight,
    borderRadius: radius.surface,
  },
  addPlus: { fontFamily: fonts.brandSemiBold, fontSize: 22, color: colors.mineral },
  addCopy: { flex: 1, gap: 2 },
  addTitle: { fontFamily: fonts.brandSemiBold, fontSize: 16 },
  hint: { color: colors.graphiteSoft, fontSize: 13, lineHeight: 19 },
  moreRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.fog,
  },
  moreLabel: { fontFamily: fonts.brandSemiBold, fontSize: 15 },
});
