import type { SFSymbol as SFSymbolName } from "expo-symbols";
import { useState, type PropsWithChildren, type ReactNode } from "react";
import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { AppIcon, EXAMPLE_APP, FAKE_APP } from "@/components/guide/app-icons";
import {
  Card,
  GlassCircle,
  InfoButton,
  IOS,
  IText,
  Pill,
  Popover,
  ProminentCircle,
  RemoveButton,
  Rhombus,
  SearchField,
  SheetTop,
  Sym,
  SwitchOff,
} from "@/components/guide/ios-kit";
import { Band, BandGap, MockText, Replica, Tap } from "@/components/guide/replica";
import { systemVariant } from "@/i18n";
import type { GuideScreenId } from "@/lib/ios-shortcut-setup";
import {
  shortcutsString,
  type ShortcutsStringKey,
  type SystemVariant,
} from "@/lib/system-strings";

/**
 * Apple's Shortcuts, redrawn: every screen the iOS guide used to show as a
 * cropped screenshot (docs/ui-clarity-plan.md §4.3). Geometry is the iPhone 15
 * capture's, in points; bands keep the crops' y-ranges; texts come from Apple's
 * own tables in the phone's language. News became Instagram; nothing else.
 */

export type ShortcutsScreenId = GuideScreenId;

type ScreenProps = { variant?: SystemVariant };

const WIDTH = 393;
/** SF Pro's ascent: where the first baseline sits below a text's top. */
const ASCENT = 0.952;

function useStrings(variant: SystemVariant) {
  return (key: ShortcutsStringKey, values?: Record<string, string>) =>
    shortcutsString(variant, key, values);
}

function at(x: number, y: number, width?: number, height?: number): ViewStyle {
  // Only set a size when given: an explicit undefined would erase the
  // element's own width/height (a circle button, an icon).
  return {
    position: "absolute",
    left: x,
    top: y,
    ...(width === undefined ? null : { width }),
    ...(height === undefined ? null : { height }),
  };
}

/** Text placed by its baseline, the way the captures were measured. */
function Line({
  x = 0,
  baseline,
  size,
  weight = "400",
  color = IOS.label,
  align = "left",
  width,
  style,
  children,
}: PropsWithChildren<{
  x?: number;
  baseline: number;
  size: number;
  weight?: "400" | "500" | "600" | "700";
  color?: string;
  align?: "left" | "center" | "right";
  width?: number;
  style?: StyleProp<TextStyle>;
}>) {
  const top = baseline - size * ASCENT;
  const box: ViewStyle =
    align === "center"
      ? { position: "absolute", left: 0, right: 0, top }
      : align === "right"
        ? { position: "absolute", right: WIDTH - x, top }
        : { position: "absolute", left: x, top, width };
  return (
    <View pointerEvents="none" style={box}>
      <IText
        color={color}
        numberOfLines={1}
        size={size}
        style={[{ textAlign: align }, style]}
        weight={weight}
      >
        {children}
      </IText>
    </View>
  );
}

/** The "When … is opened" editor header: back, centered title, blue ✓. */
function EditorHeader({
  title,
  confirmTap,
}: {
  title: string;
  confirmTap?: number;
}) {
  const check = <ProminentCircle />;
  return (
    <>
      <GlassCircle style={at(16, 13)} symbol="chevron.left" />
      <Line align="center" baseline={41} size={17} weight="600">
        {title}
      </Line>
      {confirmTap ? (
        <Tap n={confirmTap} style={at(333, 13, 44, 44)}>
          {check}
        </Tap>
      ) : (
        <View style={at(333, 13)}>{check}</View>
      )}
    </>
  );
}

/**
 * Still's action in the editor once added from its app's tile: "Pause
 * [Instagram]" on one line (measured on iOS 26.0, es-419).
 */
function StillPauseCard({ s, top }: { s: ReturnType<typeof useStrings>; top: number }) {
  return (
    <Card style={[at(16, top, 361, 55.67), { borderRadius: 28, boxShadow: "0 0.5px 10px rgba(0, 0, 0, 0.045)" }]}>
      <AppIcon icon="still" radius={5.5} size={22} style={at(16.4, 16.8)} />
      <View style={[at(48.9, 14.5), { flexDirection: "row", alignItems: "center", gap: 8 }]}>
        <IText size={20} weight="500">
          {s("stillSummaryPrefix")}
        </IText>
        <ActionToken label={EXAMPLE_APP.name} />
        {/* A 24.2-pt symbol draws the 20.7-pt ring. */}
        <Sym color={IOS.blue} name="chevron.right.circle" size={24.2} />
      </View>
      <RemoveButton style={at(322.5, 17)} />
    </Card>
  );
}

/** A parameter token inside an editor action (20-pt, like the action text). */
function ActionToken({ label, faded = false }: { label: string; faded?: boolean }) {
  return (
    <View
      style={{
        height: 26.3,
        paddingHorizontal: 6.4,
        borderRadius: 7.5,
        borderCurve: "continuous",
        justifyContent: "center",
        backgroundColor: "#EDF7FF",
      }}
    >
      <IText color={faded ? "rgba(0, 136, 255, 0.4)" : IOS.blue} size={20} weight="500">
        {label}
      </IText>
    </View>
  );
}

// ---------------------------------------------------------------- automation

function AutoAppTrigger({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  // The subtitle wraps at 275 pt (Spanish takes two lines) and pushes the card.
  const [subtitleLines, setSubtitleLines] = useState(1);
  const extra = (subtitleLines - 1) * 20.3;
  return (
    <Replica width={WIDTH}>
      <Band background={IOS.groupedBackground} height={160 + extra}>
        <SheetTop top={-3} />
        <Line baseline={41.8} size={22} weight="700" x={35.8}>
          {s("personalAutomation")}
        </Line>
        <View style={at(36, 50.01, 275)}>
          <MockText
            onTextLayout={(event) => setSubtitleLines(Math.max(1, event.nativeEvent.lines.length))}
            style={{ fontSize: 15, lineHeight: 20.3, color: IOS.secondaryLabel }}
          >
            {s("personalAutomationSubtitle")}
          </MockText>
        </View>
        <Tap n={2} style={at(20, 83.3 + extra, 353, 61.7)}>
          <Card style={{ flex: 1 }}>
            <AppIcon icon="trigger" size={20} style={at(18, 20.7)} />
            <Line baseline={27} size={17} x={57}>
              {s("app")}
            </Line>
            <Line baseline={46.5} color={IOS.secondaryLabel} size={12} width={260} x={56.8}>
              {s("appTriggerExample")}
            </Line>
            <Sym color={IOS.gray3} name="chevron.right" size={14} style={at(321, 23.7)} weight="semibold" />
          </Card>
        </Tap>
      </Band>
      <BandGap />
      <Band background={IOS.groupedBackground} height={71}>
        <Tap n={1} style={at(28, 11, 277, 48)}>
          <SearchField
            clear
            clearSize={20.8}
            gap={8.8}
            glass
            iconSize={20}
            leading={17.4}
            style={{ height: 48, borderRadius: 24 }}
            text="App"
            trailing={18.9}
            typed
          />
        </Tap>
        <GlassCircle glyph={22} size={48} style={at(317, 11)} symbol="xmark" />
      </Band>
    </Replica>
  );
}

function AutoChoose({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  // Over this page the bar's glass casts a wider, darker halo.
  const halo = "0 6px 30px rgba(0, 0, 0, 0.14)";
  return (
    <Replica width={WIDTH}>
      <Band background={IOS.groupedBackground} height={188}>
        <SheetTop top={-3} />
        <GlassCircle shadow={halo} style={at(16, 13)} symbol="chevron.left" />
        <Pill enabled={false} label={s("next")} shadow={halo} style={{ position: "absolute", right: 16.33, top: 13.3 }} />
        <Line baseline={106} size={22} weight="700" x={20}>
          {s("when")}
        </Line>
        <Card style={at(20, 123.3, 353, 52)}>
          <Line baseline={32.2} size={17} x={15.8}>
            {s("app")}
          </Line>
          <Tap
            n={1}
            style={{ position: "absolute", right: 5, top: 7.7, height: 38, justifyContent: "center", paddingLeft: 8.8, paddingRight: 10.4 }}
          >
            <IText color={IOS.blue} size={17}>
              {s("choose")}
            </IText>
          </Tap>
        </Card>
      </Band>
    </Replica>
  );
}

function AutoPickApp({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  const listSeparator = { height: 1, backgroundColor: "#E8E8E8" };
  return (
    <Replica width={WIDTH}>
      <Band background="#FFFFFF" height={78}>
        <SheetTop background="#FFFFFF" top={-3} />
        <GlassCircle fill="#FFFFFF" glyph={22} style={at(15.5, 13.5)} symbol="xmark" />
        <Line align="center" baseline={40.7} size={17} weight="600">
          {s("chooseApp")}
        </Line>
        <Tap n={2} style={at(333, 13, 44, 44)}>
          <ProminentCircle />
        </Tap>
      </Band>
      <BandGap />
      <Band background="#FFFFFF" height={106}>
        <AppIcon icon="messages" size={29} style={at(20, 11.3)} />
        <Line baseline={32.3} size={17} x={64}>
          {s("messages")}
        </Line>
        <View style={[at(64, 51, 309), listSeparator]} />
        <Tap n={1} style={at(14, 54, 365, 50)}>
          <View style={{ flex: 1 }}>
            <AppIcon icon={EXAMPLE_APP.icon} size={29} style={at(6, 9.3)} />
            <Line baseline={30.8} size={17} x={50}>
              {EXAMPLE_APP.name}
            </Line>
            <Sym color={IOS.blue} name="checkmark" size={19.5} style={at(337.25, 14.25)} weight="semibold" />
          </View>
        </Tap>
        <View style={[at(64, 103, 309), listSeparator]} />
      </Band>
    </Replica>
  );
}

function AutoRunImmediately({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  const halo = "0 6px 30px rgba(0, 0, 0, 0.14)";
  const rowSeparator = { height: 1, backgroundColor: "#E8E8E8" };
  return (
    <Replica width={WIDTH}>
      <Band background={IOS.groupedBackground} height={70}>
        <SheetTop top={-3} />
        <GlassCircle shadow={halo} style={at(16, 13)} symbol="chevron.left" />
        <Tap n={3} style={{ position: "absolute", right: 16.33, top: 13.3 }}>
          <Pill enabled label={s("next")} shadow={halo} />
        </Tap>
      </Band>
      <BandGap />
      <Band background={IOS.groupedBackground} height={172}>
        <Card style={at(20, 8.33, 353, 156)}>
          <Line baseline={32.34} size={17} x={16}>
            {s("runAfterConfirmation")}
          </Line>
          <View style={[at(16, 51, 321), rowSeparator]} />
          <Tap n={1} style={at(0, 52, 353, 51)}>
            <View style={{ flex: 1 }}>
              <Line baseline={32.34} size={17} x={16}>
                {s("runImmediately")}
              </Line>
              <Sym color={IOS.blue} name="checkmark" size={19.5} style={at(311.25, 16.25)} weight="semibold" />
            </View>
          </Tap>
          <View style={[at(16, 103, 321), rowSeparator]} />
          <Line baseline={136.34} size={17} x={16}>
            {s("notifyWhenRun")}
          </Line>
          <Tap n={2} style={at(270, 116, 63, 28)}>
            <SwitchOff />
          </Tap>
        </Card>
      </Band>
    </Replica>
  );
}

/**
 * The "Create New Shortcut" glyph: Shortcuts' two layers in outline with a ⊕.
 * Apple draws it from a private symbol, so it is rebuilt here: outlines are a
 * grey rhombus with the tile's color inside, and the top layer and the badge
 * knock out what passes under them. Coordinates are the tile's, in points.
 */
function CreateShortcutGlyph() {
  const ink = "#7A7B81";
  const outer = { cx: 33.65, hw: 15, hh: 10.9, radius: 4.5 };
  const inner = { cx: 33.65, hw: 11.67, hh: 7.83, radius: 1.8 };
  // A knockout at (x, y) repaints the tile's own gradient, so it disappears.
  // (Object form: RN's string parser drops "at" after an explicit size.)
  const ground = (x: number, y: number) => [
    {
      type: "radial-gradient" as const,
      shape: "circle" as const,
      size: { x: 139.5, y: 139.5 },
      position: { top: -y, left: 80 - x },
      colorStops: [
        { color: "#E7E7EC", positions: ["0%"] },
        { color: "#C7C7CC", positions: ["100%"] },
      ],
    },
  ];
  const knockout = (x: number, y: number, width: number, height: number, radius: number) => (
    <View
      style={[at(x, y, width, height), { borderRadius: radius, experimental_backgroundImage: ground(x, y) }]}
    />
  );
  return (
    <>
      <Rhombus {...outer} color={ink} cy={36.11} />
      <Rhombus {...inner} color="#D9D9DE" cy={36.11} />
      <Rhombus color="#DADADF" cx={33.65} cy={24.44} hh={11.15} hw={15.3} radius={4.8} />
      <Rhombus {...outer} color={ink} cy={24.44} />
      <Rhombus {...inner} color="#DBDBE0" cy={24.44} />
      {knockout(48.03 - 9.3, 19.81 - 9.3, 18.6, 18.6, 9.3)}
      <View style={[at(48.03 - 7.36, 19.81 - 7.36, 14.72, 14.72), { borderRadius: 7.36, backgroundColor: ink }]} />
      {knockout(48.03 - 1, 19.86 - 4.75, 2, 9.5, 1)}
      {knockout(48.03 - 4.65, 19.86 - 1.03, 9.3, 2.05, 1)}
    </>
  );
}

function AutoCreateNew({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  const tileTitle = { lineHeight: 21.33 } as const;
  // Tile titles sit on the tile's bottom and wrap at 131 pt (16-pt insets),
  // so a longer title grows upward: "Crear nuevo / atajo" in Spanish.
  const titleBox = { position: "absolute", left: 16, width: 131, bottom: 14.59 } as const;
  return (
    <Replica width={WIDTH}>
      <Band background={IOS.groupedBackground} height={256}>
        <View style={at(16, 0.33, 360)}>
          <IText size={34} style={{ lineHeight: 41 }} weight="700">
            {s("whenOpened", { app: EXAMPLE_APP.name })}
          </IText>
        </View>
        <Sym color={IOS.blue} name="lightbulb" size={26.5} style={at(19.9, 94.6)} />
        <View style={[at(54, 95.6), { flexDirection: "row", alignItems: "center", gap: 2.6 }]}>
          <IText size={20} weight="600">
            {s("getStarted")}
          </IText>
          <Sym color="#85858B" name="chevron.right" size={16.8} style={{ marginTop: 1.6 }} weight="semibold" />
        </View>
        <Tap n={1} style={at(16, 132, 163, 112)}>
          <View
            style={{
              flex: 1,
              borderRadius: 22,
              borderCurve: "continuous",
              overflow: "hidden",
              experimental_backgroundImage: "radial-gradient(circle at 49% 0%, #E7E7EC 0%, #C7C7CC 100%)",
            }}
          >
            <CreateShortcutGlyph />
            <View style={titleBox}>
              <IText color="#7A7A80" size={17} style={tileTitle} weight="600">
                {s("createNewShortcut")}
              </IText>
            </View>
          </View>
        </Tap>
        <Card style={[at(189, 132, 163, 112), { borderRadius: 22 }]}>
          <AppIcon icon="shortcuts" size={28} style={at(16, 15.8)} />
          <View style={titleBox}>
            <IText size={17} style={tileTitle} weight="600">
              {s("unknownAction")}
            </IText>
          </View>
        </Card>
        {/* The next suggestion, cut by the screen's edge as in the capture. */}
        <Card style={[at(362, 132, 163, 112), { borderRadius: 22 }]}>
          <AppIcon icon={EXAMPLE_APP.icon} size={28} style={at(16, 15.8)} />
          <View style={titleBox}>
            <IText size={17} style={tileTitle} weight="600">
              {"Se\nLo"}
            </IText>
          </View>
        </Card>
      </Band>
    </Replica>
  );
}

/** A category chip of the action library: blue symbol and label on white. */
function ActionChip({
  symbol,
  iconSize,
  lead,
  gap,
  trail,
  label,
}: {
  symbol: "applescript" | "switch.2" | "iphone";
  iconSize: number;
  /** Symbols carry their own side bearings, so each chip is measured apart. */
  lead: number;
  gap: number;
  trail: number;
  label: string;
}) {
  return (
    <View
      style={{
        height: 42,
        borderRadius: 21,
        paddingLeft: lead,
        paddingRight: trail,
        flexDirection: "row",
        alignItems: "center",
        gap,
        backgroundColor: "#FFFFFF",
        boxShadow: "0 1px 6px rgba(0, 0, 0, 0.04)",
      }}
    >
      <Sym color={IOS.blue} name={symbol} size={iconSize} />
      <IText color={IOS.blue} size={17}>
        {label}
      </IText>
    </View>
  );
}

/** The chips row (Scripting, Controls, Device and the next one, cut). */
function ActionChips({ s, x, top }: { s: ReturnType<typeof useStrings>; x: number; top: number }) {
  return (
    <View style={[at(x, top), { flexDirection: "row", gap: 12 }]}>
      <ActionChip gap={4} iconSize={20.87} label={s("scripting")} lead={9.93} symbol="applescript" trail={13.37} />
      <ActionChip gap={5.67} iconSize={18.7} label={s("controls")} lead={12.06} symbol="switch.2" trail={13.83} />
      <ActionChip gap={4.8} iconSize={18} label={s("device")} lead={10.77} symbol="iphone" trail={12.97} />
      <View style={{ width: 90, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF" }} />
    </View>
  );
}

/**
 * The action library at rest (a sheet at its medium height): inset 6.67 pt,
 * search field at full size, and the chips and results drawn at 0.968 of the
 * expanded library's size (auto-07). Children use sheet coordinates.
 */
function LibrarySheet({ top, children }: PropsWithChildren<{ top: number }>) {
  const frame = at(6.67, top, 379.67, 400);
  return (
    <>
      <View style={[frame, { borderRadius: 40, backgroundColor: "#F0F0F4", boxShadow: "0 0 18px rgba(0, 0, 0, 0.07)" }]} />
      <View style={[frame, { borderRadius: 40, overflow: "hidden", backgroundColor: "#F0F0F4" }]}>
        <View style={[at(162, 6.33, 56, 4.67), { borderRadius: 2.33, backgroundColor: IOS.gray4 }]} />
        {children}
      </View>
      {/* Its bright rim, drawn over the content. */}
      <View pointerEvents="none" style={[frame, { borderRadius: 40, borderWidth: 0.67, borderColor: "#FBFBFC" }]} />
    </>
  );
}

function LibrarySearch({ s }: { s: ReturnType<typeof useStrings> }) {
  return (
    <SearchField
      fill="#DFDFE3"
      gap={7.7}
      iconSize={20}
      leading={12.2}
      mic
      micSize={21.2}
      placeholder={s("searchActions")}
      style={{ height: 44, borderRadius: 22 }}
      textWeight="500"
      tint="#7D7D83"
      trailing={14.1}
    />
  );
}

/** Content laid out as in the expanded library, shrunk to the resting size. */
function RestingScale({ top, height, children }: PropsWithChildren<{ top: number; height: number }>) {
  // Spans the screen (the sheet starts 6.67 pt in), so it shrinks toward its center.
  return (
    <View
      style={{
        position: "absolute",
        left: -6.67,
        top,
        width: WIDTH,
        height,
        transformOrigin: "50% 0%",
        transform: [{ scale: 0.968 }],
      }}
    >
      {children}
    </View>
  );
}

function AutoSearchActions({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  return (
    <Replica width={WIDTH}>
      <Band background={IOS.groupedBackground} height={70}>
        <SheetTop top={-3} />
        <EditorHeader title={s("whenOpened", { app: EXAMPLE_APP.name })} />
      </Band>
      <BandGap />
      <Band
        background="#E9E9EE"
        height={80}
        style={{ experimental_backgroundImage: "linear-gradient(180deg, #E9E9EE 0%, #DCDCE1 100%)" }}
      >
        <LibrarySheet top={3.3}>
          <Tap n={1} style={at(19.33, 17.7, 341, 44)}>
            <LibrarySearch s={s} />
          </Tap>
          <RestingScale height={60} top={72.7}>
            <ActionChips s={s} top={0} x={20.33} />
          </RestingScale>
        </LibrarySheet>
      </Band>
    </Replica>
  );
}

/**
 * The expanded action library with a search typed: sheet top, grabber, field,
 * Cancel and the chips. `y` shifts it all (the captures crop it differently).
 */
function SearchingLibrary({ s, y, text, fieldTap }: { s: ReturnType<typeof useStrings>; y: number; text: string; fieldTap?: number }) {
  const field = (
    <SearchField
      clear
      clearSize={20.8}
      gap={7.7}
      iconSize={20}
      leading={12.2}
      style={fieldTap ? { height: 44, borderRadius: 22 } : at(20, y + 11, 287, 44)}
      text={text}
      textWeight="500"
      typed
    />
  );
  return (
    <>
      <SheetTop backdrop="#B8B8BC" background="#F4F4F7" inset={2.8} top={y - 7} />
      <View style={[at(168.67, y - 0.67, 56, 5), { borderRadius: 2.5, backgroundColor: "#CFCFD2" }]} />
      {fieldTap ? (
        <Tap n={fieldTap} style={at(20, y + 11, 287, 44)}>
          {field}
        </Tap>
      ) : (
        field
      )}
      <Line baseline={y + 39.2} color={IOS.blue} size={17} x={320}>
        {s("cancel")}
      </Line>
      <ActionChips s={s} top={y + 68.33} x={20.33} />
    </>
  );
}

/**
 * One tile per app chosen in Still under its "Pause App" action: Shortcuts
 * builds them from the App Shortcuts Still declares (StillPauseAppIntent.swift).
 */
function PauseTile({ x, label }: { x: number; label: string }) {
  return (
    <>
      <View style={[at(x, 52, 56, 56), { borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#E6F3FF" }]}>
        <Sym color="#0088FF" name="pause.circle" size={34.5} />
      </View>
      <Line baseline={127} size={13} style={{ textAlign: "center" }} width={96} x={x - 20}>
        {label}
      </Line>
    </>
  );
}

function AutoPickAction({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  return (
    <Replica width={WIDTH}>
      <Band background="#F4F4F7" height={366}>
        <SearchingLibrary s={s} text="Still" y={0} />
        <AppIcon icon="still" radius={10.8} size={48} style={at(24, 134.33)} />
        <Line baseline={164.67} size={17} weight="600" x={88}>
          Still
        </Line>
        <Card style={at(20, 209.33, 353, 144.33)}>
          <AppIcon icon="still" radius={5.9} size={25.5} style={at(16.25, 13.17)} />
          <Line baseline={32.33} size={17} weight="600" x={51.83}>
            {s("stillAction")}
          </Line>
          <InfoButton style={at(315.67, 15)} />
          <Tap n={1} style={at(5, 46, 84, 92)} />
          <PauseTile label={EXAMPLE_APP.name} x={19} />
          <PauseTile label={FAKE_APP.name} x={105.33} />
        </Card>
      </Band>
    </Replica>
  );
}

function AutoSave({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  return (
    <Replica width={WIDTH}>
      <Band background={IOS.groupedBackground} height={150}>
        <SheetTop top={-3} />
        <EditorHeader confirmTap={1} title={s("whenOpened", { app: EXAMPLE_APP.name })} />
        <StillPauseCard s={s} top={83} />
      </Band>
    </Replica>
  );
}

// ------------------------------------------------------------- return shortcut

/** An action in the library's results: icon, name and ⓘ, as auto-07 measured. */
function ActionResultCard({ icon, label }: { icon: "still" | "messages" | "openApp" | "currentApp"; label: string }) {
  return (
    <Card style={{ flex: 1 }}>
      {/* iOS draws app icons at 25.5 pt here and its own action glyphs a touch larger. */}
      {icon === "still" ? (
        <AppIcon icon="still" radius={5.9} size={25.5} style={at(16.25, 13.17)} />
      ) : (
        <AppIcon icon={icon} size={26.4} style={at(15.6, 12.7)} />
      )}
      <Line baseline={32.33} size={17} weight="600" x={51.83}>
        {label}
      </Line>
      <InfoButton style={at(315.67, 15)} />
    </Card>
  );
}

function ReturnOpenApp({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  return (
    <Replica width={WIDTH}>
      <Band
        background="#E9E9EE"
        height={244}
        style={{ experimental_backgroundImage: "linear-gradient(180deg, #E3E3E8 0%, #DCDCE1 100%)" }}
      >
        <LibrarySheet top={-9}>
          <View style={at(19.33, 18, 341, 44)}>
            <LibrarySearch s={s} />
          </View>
          <RestingScale height={200} top={73}>
            <ActionChips s={s} top={0} x={20.33} />
            <View style={at(20, 57.16, 353, 52)}>
              <ActionResultCard icon="messages" label={s("sendMessage")} />
            </View>
            <View style={at(20, 123.27, 353, 52)}>
              <ActionResultCard icon="openApp" label={s("openApp")} />
            </View>
          </RestingScale>
        </LibrarySheet>
        {/* The ring sits outside the scaled content, on the row as drawn. */}
        <Tap n={1} style={at(25.67, 183.33, 342, 50.33)} />
      </Band>
    </Replica>
  );
}

/** A shortcut's own icon: Shortcuts' layers, filled white, on grey. */
function ShortcutGlyphIcon() {
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 5.4,
        borderCurve: "continuous",
        overflow: "hidden",
        experimental_backgroundImage: "linear-gradient(180deg, #8E98A1 0%, #7F8A95 100%)",
      }}
    >
      <Rhombus color="#FFFFFF" cx={12} cy={14.87} hh={5.1} hw={7} radius={2.2} />
      <Rhombus color="#858F9A" cx={12} cy={8.94} hh={6.45} hw={8.66} radius={2.8} />
      <Rhombus color="#FFFFFF" cx={12} cy={8.94} hh={5.21} hw={7} radius={2.2} />
    </View>
  );
}

/**
 * A one-line action card of the editor: icon, a sentence with one parameter
 * token (a template like "Open {x}") and the ⓧ. Measured on "Open [App]".
 */
function ParamCard({
  icon,
  sentence,
  token,
  faded,
  tapToken,
  top,
}: {
  icon: "openApp" | "currentApp";
  sentence: string;
  token: string;
  faded?: boolean;
  tapToken?: number;
  top: number;
}) {
  const [before, after] = sentence.split("\u0000");
  const chip = <ActionToken faded={faded} label={token} />;
  return (
    <Card style={at(16, top, 361, 55.67)}>
      <AppIcon icon={icon} size={23} style={at(16, 16)} />
      <View style={[at(49, 14.18), { flexDirection: "row", alignItems: "center", gap: 7.87 }]}>
        {before.trim() ? (
          <IText size={20} weight="500">
            {before.trim()}
          </IText>
        ) : null}
        {tapToken ? <Tap n={tapToken}>{chip}</Tap> : chip}
        {after?.trim() ? (
          <IText size={20} weight="500">
            {after.trim()}
          </IText>
        ) : null}
      </View>
      <RemoveButton style={at(322.5, 16.67)} />
    </Card>
  );
}

function OpenAppCard({ s, top, tapToken }: { s: ReturnType<typeof useStrings>; top: number; tapToken?: number }) {
  return (
    <ParamCard
      faded
      icon="openApp"
      sentence={s("openTarget", { x: "\u0000" })}
      tapToken={tapToken}
      token={s("app")}
      top={top}
    />
  );
}

/** The editor's title: the shortcut's icon, its name and a ⌄ for its menu. */
function ShortcutTitle({ s }: { s: ReturnType<typeof useStrings> }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
      <ShortcutGlyphIcon />
      <IText size={17} weight="600">
        {s("newShortcutN")}
      </IText>
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "#E3E3E8", alignItems: "center", justifyContent: "center" }}>
        <Sym color={IOS.gray} name="chevron.down" size={11.5} weight="bold" />
      </View>
    </View>
  );
}

function ReturnChooseApp({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  return (
    <Replica width={WIDTH}>
      <Band background={IOS.groupedBackground} height={144}>
        <GlassCircle style={at(16, 7.33)} symbol="chevron.left" />
        <Tap n={2} style={at(100, 10, 190, 38)}>
          <ShortcutTitle s={s} />
        </Tap>
        <OpenAppCard s={s} tapToken={1} top={77} />
      </Band>
    </Replica>
  );
}

function ReturnRename({ variant = systemVariant }: ScreenProps) {
  const s = useStrings(variant);
  // Symbols at their natural proportions (wide ones would shrink in a square).
  const rows: { symbol: "pencil" | "square.dashed" | "plus.rectangle.on.rectangle" | "folder"; key: ShortcutsStringKey; w: number; h: number }[] = [
    { symbol: "pencil", key: "rename", w: 17, h: 17 },
    { symbol: "square.dashed", key: "chooseIcon", w: 19.75, h: 19.75 },
    { symbol: "plus.rectangle.on.rectangle", key: "duplicate", w: 24.8, h: 20.5 },
    { symbol: "folder", key: "move", w: 23.24, h: 18.72 },
  ];
  // Menu-relative, inside its 0.67-pt rim.
  const iconX = 35.33;
  const textX = 59.43;
  const row = (symbol: SFSymbolName, w: number, h: number, key: ShortcutsStringKey, iconY: number, baseline: number) => (
    <>
      <Sym name={symbol} size={w} height={h} style={at(iconX - w / 2, iconY - h / 2)} width={w} />
      <Line baseline={baseline} size={17} x={textX}>
        {s(key)}
      </Line>
    </>
  );
  const [homeLines, setHomeLines] = useState(1);
  const extra = (homeLines - 1) * 22;
  return (
    <Replica width={WIDTH}>
      <Band background={IOS.groupedBackground} height={268 + extra}>
        {/* The editor under the menu. */}
        <GlassCircle style={at(16, -2.67)} symbol="chevron.left" />
        <View style={at(100, 0, 190, 38)}>
          <ShortcutTitle s={s} />
        </View>
        <OpenAppCard s={s} top={67} />
        <Popover style={at(71.67, 9, 249.33, 251 + extra)}>
          <Tap n={1} style={at(11.66, 8.33, 232, 44)} />
          {rows.map((r, i) => (
            <View key={r.key} style={at(0, 0, 0, 0)}>
              {row(r.symbol, r.w, r.h, r.key, 30.66 + i * 42 - (i === 2 ? 0.16 : 0), 36.66 + i * 42)}
            </View>
          ))}
          <View style={[at(23.33, 187.66, 202, 1), { backgroundColor: "#E3E3E7" }]} />
          {/* The menu keeps its width: a long last item wraps and the menu grows. */}
          <Sym name="plus.square" size={19.75} style={at(iconX - 9.875, 209.785 + extra / 2)} />
          <View style={at(textX, 208.62, 160)}>
            <MockText
              onTextLayout={(event) => setHomeLines(Math.max(1, event.nativeEvent.lines.length))}
              style={{ fontSize: 17, lineHeight: 22, color: IOS.label }}
            >
              {s("addToHomeScreen")}
            </MockText>
          </View>
        </Popover>
      </Band>
    </Replica>
  );
}

export const SHORTCUTS_SCREENS: Record<ShortcutsScreenId, (props: ScreenProps) => ReactNode> = {
  "auto-01-app-trigger": AutoAppTrigger,
  "auto-02-choose": AutoChoose,
  "auto-03-pick-app": AutoPickApp,
  "auto-04-run-immediately": AutoRunImmediately,
  "auto-05-create-new": AutoCreateNew,
  "auto-06-search-actions": AutoSearchActions,
  "auto-07-pick-action": AutoPickAction,
  "auto-09-save": AutoSave,
  "return-01-open-app": ReturnOpenApp,
  "return-02-choose-app": ReturnChooseApp,
  "return-03-rename": ReturnRename,
};
