import { useState, type ReactNode } from "react";
import { View } from "react-native";

import {
  AIcon,
  ALine,
  ANDROID,
  at,
  StillLauncherIcon,
  SwitchOffM3,
} from "@/components/guide/android-kit";
import { Band, Replica, Tap } from "@/components/guide/replica";
import { systemVariant } from "@/i18n";
import {
  androidSettingsString,
  type AndroidSettingsStringKey,
  type SystemVariant,
} from "@/lib/system-strings";

/**
 * Android 14's Accessibility settings, redrawn: the three screens the Android
 * guide used to show as cropped captures of the Pixel 6 emulator
 * (docs/ui-clarity-plan.md §4.4). Geometry is the capture's, in dp; texts are
 * AOSP's own (android14-release) in the phone's language.
 */

export type AndroidScreenId =
  | "accessibility-find-still"
  | "accessibility-turn-on"
  | "accessibility-allow";

type ScreenProps = { variant?: SystemVariant };

/** Pixel 6: 1080 px at 2.625 px/dp. */
const WIDTH = 1080 / 2.625;
const APP = "Still";

/**
 * Still's own description of its accessibility service. Android shows it on
 * the service's page as the app ships it (English only for now).
 */
const SERVICE_DESCRIPTION =
  "Pauses only the apps you select, and closes a floating video that would cover the pause. Still does not collect, store, or share your screen content, what you type, or your app history.";

function useStrings(variant: SystemVariant) {
  return (key: AndroidSettingsStringKey) =>
    androidSettingsString(variant, key, { app: APP });
}

function FindStill({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  return (
    <Replica width={WIDTH}>
      <Band background={ANDROID.background} height={150.86}>
        <ALine baseline={27.81} color={ANDROID.primary} size={14} x={24}>
          {s("downloadedApps")}
        </ALine>
        <Tap n={1} style={at(15.24, 40.76, 380.95, 67.05)}>
          <View style={{ flex: 1 }}>
            <StillLauncherIcon size={32} style={at(8.76, 22.48)} />
            <ALine baseline={36.17} size={20} x={56.76}>
              Still
            </ALine>
            <ALine baseline={57.34} color={ANDROID.onSurfaceVariant} size={14} x={56.76}>
              {s("off")}
            </ALine>
          </View>
        </Tap>
        {/* The next category, cut by the capture's edge. */}
        <ALine baseline={157.67} color={ANDROID.primary} size={14} x={24}>
          {s("screenReader")}
        </ALine>
      </Band>
    </Replica>
  );
}

/** The "Use Still" card of Still's page in Accessibility. */
function UseServiceCard({ s, top, children }: { s: ReturnType<typeof useStrings>; top: number; children: ReactNode }) {
  return (
    <View
      style={[
        at(24, top, 371.43, 75.05),
        { borderRadius: 28, backgroundColor: ANDROID.card },
      ]}
    >
      <ALine baseline={44.93} color={ANDROID.onCard} size={20} x={20.18}>
        {s("useService")}
      </ALine>
      {children}
    </View>
  );
}

function TurnOn({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  return (
    <Replica width={WIDTH}>
      <Band background={ANDROID.background} height={304.76}>
        <AIcon color={ANDROID.arrow} name="arrow-back" size={24} style={at(16.19, 18.29)} />
        <ALine baseline={149.63} size={36} x={24}>
          Still
        </ALine>
        <UseServiceCard s={s} top={198.1}>
          <Tap n={1} style={at(295.62, 23.61, 55.62, 27.81)}>
            <SwitchOffM3 />
          </Tap>
        </UseServiceCard>
      </Band>
    </Replica>
  );
}

/**
 * A dialog text's wrap against the English capture's: the dialog grows (or
 * shrinks) by a line height per line of difference, like Android's own.
 */
function useWrap(englishLines: number, lineHeight: number) {
  const [lines, setLines] = useState(englishLines);
  return { extra: (lines - englishLines) * lineHeight, onLines: setLines };
}

function Allow({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  const title = useWrap(2, 23.46);
  const warning = useWrap(3, 18.32);
  const screenControl = useWrap(2, 16.02);
  const actionPerform = useWrap(3, 16.02);
  // How far each part of the dialog moves down when a text above it wraps.
  const toWarning = title.extra;
  const toScreenControl = toWarning + warning.extra;
  const toActionPerform = toScreenControl + screenControl.extra;
  const toButtons = toActionPerform + actionPerform.extra;
  const height = 449.52 + toButtons;
  // Still's page under the dialog, as far down as the capture reaches.
  const page = (
    <>
      <UseServiceCard s={s} top={15.24}>
        <SwitchOffM3 style={at(295.62, 23.61)} />
      </UseServiceCard>
      <ALine baseline={145.3} color={ANDROID.primary} size={14} x={24}>
        {s("options")}
      </ALine>
      <ALine baseline={195.2} size={20} x={24}>
        {s("shortcutTitle")}
      </ALine>
      <ALine baseline={215.8} color={ANDROID.onSurfaceVariant} size={14} x={24}>
        {s("off")}
      </ALine>
      <View style={[at(322.29, 173.72, 1.14, 46.48), { backgroundColor: ANDROID.divider }]} />
      <SwitchOffM3 style={at(339.81, 183.23)} />
      <AIcon color={ANDROID.onSurfaceVariant} name="info-outline" size={24} style={at(23.9, 252.1)} />
      <ALine baseline={311.6} color={ANDROID.onSurfaceVariant} lineHeight={16.4} size={14} width={360} x={24}>
        {SERVICE_DESCRIPTION}
      </ALine>
    </>
  );
  return (
    <Replica width={WIDTH}>
      <Band background={ANDROID.background} height={height}>
        {page}
        <View style={[at(0, 0, WIDTH, height), { backgroundColor: ANDROID.scrim }]} />
        <View
          style={[
            at(26.67, -80, 358.1, 620 + toButtons),
            { borderRadius: 28, backgroundColor: ANDROID.dialog, boxShadow: "0 6px 24px rgba(0, 0, 0, 0.3)" },
          ]}
        />
        <StillLauncherIcon size={36} style={at(187.52, -31.47)} />
        <ALine
          align="center"
          baseline={41.47}
          lineHeight={23.46}
          onLines={title.onLines}
          size={20}
          width={310}
          x={50.67}
        >
          {s("enableServiceTitle")}
        </ALine>
        <ALine
          baseline={103.81 + toWarning}
          lineHeight={18.32}
          onLines={warning.onLines}
          size={16}
          width={310}
          x={50.67}
        >
          {s("warningDescription")}
        </ALine>
        <AIcon color={ANDROID.onSurface} name="visibility" size={17.6} style={at(50.73, 177.9 + toScreenControl)} />
        <ALine baseline={195.43 + toScreenControl} size={16} x={80.62}>
          {s("screenControlTitle")}
        </ALine>
        <ALine
          baseline={214.71 + toScreenControl}
          color={ANDROID.onSurfaceVariant}
          lineHeight={16.02}
          onLines={screenControl.onLines}
          size={14}
          width={279.76}
          x={80.62}
        >
          {s("screenControlDescription")}
        </ALine>
        <AIcon color={ANDROID.onSurface} name="pan-tool" size={17.7} style={at(50.76, 259.33 + toActionPerform)} />
        <ALine baseline={276.95 + toActionPerform} size={16} x={80.62}>
          {s("actionPerformTitle")}
        </ALine>
        <ALine
          baseline={296.33 + toActionPerform}
          color={ANDROID.onSurfaceVariant}
          lineHeight={16.02}
          onLines={actionPerform.onLines}
          size={14}
          width={279.76}
          x={80.62}
        >
          {s("actionPerformDescription")}
        </ALine>
        <View style={[at(26.67, 357.71 + toButtons, 358.1, 1.15), { backgroundColor: ANDROID.divider }]} />
        <Tap n={1} style={at(26.67, 358.86 + toButtons, 358.1, 56)}>
          <View style={{ flex: 1 }}>
            <ALine align="center" baseline={33.52} color={ANDROID.primary} size={14} width={358.1} x={0}>
              {s("allow")}
            </ALine>
          </View>
        </Tap>
        <View style={[at(26.67, 414.86 + toButtons, 358.1, 1.15), { backgroundColor: ANDROID.divider }]} />
        <ALine
          align="center"
          baseline={449.14 + toButtons}
          color={ANDROID.primary}
          size={14}
          width={358.1}
          x={26.67}
        >
          {s("deny")}
        </ALine>
      </Band>
    </Replica>
  );
}

export const ANDROID_SCREENS: Record<AndroidScreenId, (props: ScreenProps) => ReactNode> = {
  "accessibility-find-still": FindStill,
  "accessibility-turn-on": TurnOn,
  "accessibility-allow": Allow,
};
