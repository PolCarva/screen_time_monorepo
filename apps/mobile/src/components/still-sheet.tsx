import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/primary-button";
import { localize } from "@/i18n";
import {
  emptySheetQueue,
  enqueueSheet,
  settleSheet,
  sheetKey,
  type QueuedSheet,
  type SheetChoice,
  type SheetQueueState,
} from "@/lib/sheet-queue";
import { colors, fonts, motion, radius, shadows, spacing } from "@/theme/tokens";

export type SheetAction = {
  label: string;
  variant?: "signal" | "primary" | "secondary" | "quiet" | "danger";
  /** Runs once the sheet has left the screen, never while it is closing. */
  onPress?: () => void | Promise<void>;
};

export type SheetOptions = {
  title: string;
  message?: string;
  /** Only for lists the sheet must spell out: a permission's scope, per-app details. */
  bullets?: string[];
  /** The first action is the main one; "Not now"/"Close" goes last. */
  actions: SheetAction[];
  /** Backdrop, swipe down and Android back close it with `null`. Default true. */
  dismissible?: boolean;
};

export type ToastOptions = {
  message: string;
  tone?: "success" | "neutral";
};

export type SheetApi = {
  show(options: SheetOptions): Promise<SheetChoice>;
  toast(options: ToastOptions): void;
};

const SheetContext = createContext<SheetApi | null>(null);

/** Where a toast sits: above either tab bar, below the content it confirms. */
const TOAST_BOTTOM_OFFSET = 88;
const TOAST_DURATION_MS = 4_000;

export function retryAction(onPress: () => void | Promise<void>): SheetAction {
  return { label: localize("Try again", "Reintentar"), variant: "signal", onPress };
}

export function closeAction(): SheetAction {
  return { label: localize("Close", "Cerrar"), variant: "quiet" };
}

export function notNowAction(): SheetAction {
  return { label: localize("Not now", "Ahora no"), variant: "quiet" };
}

export function gotItAction(): SheetAction {
  return { label: localize("Got it", "Entendido"), variant: "signal" };
}

function Sheet({
  options,
  onClosed,
}: {
  options: SheetOptions;
  onClosed(choice: SheetChoice): void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const titleRef = useRef<Text>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const dismissible = options.dismissible !== false;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // Same settle curve as the rest of Still: quick to rise, slow to land.
    Animated.timing(progress, {
      toValue: 1,
      duration: motion.reveal - 120,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start(() => {
      if (titleRef.current)
        AccessibilityInfo.sendAccessibilityEvent(titleRef.current, "focus");
    });
  }, [progress]);

  const close = useCallback(
    (choice: SheetChoice) => {
      if (closing.current) return;
      closing.current = true;
      Animated.timing(progress, {
        toValue: 0,
        duration: motion.fast + 40,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onClosed(choice));
    },
    [onClosed, progress],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          dismissible &&
          gesture.dy > 4 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) =>
          drag.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 90 || gesture.vy > 1) {
            close(null);
            return;
          }
          Animated.spring(drag, {
            toValue: 0,
            bounciness: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(drag, {
            toValue: 0,
            bounciness: 0,
            useNativeDriver: true,
          }).start(),
      }),
    [close, dismissible, drag],
  );

  // Reduce Motion keeps the fade and drops the travel.
  const travel = reduceMotion ? 0 : height;
  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [travel, 0] }),
    drag,
  );

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no"
          disabled={!dismissible}
          onPress={() => close(null)}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            maxHeight: height - insets.top - spacing.xl,
            paddingBottom: insets.bottom + spacing.lg,
            opacity: reduceMotion ? progress : 1,
            transform: [{ translateY }],
          },
        ]}
      >
        <View {...pan.panHandlers} style={styles.grabberZone}>
          <View style={styles.grabber} />
        </View>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <Text accessibilityRole="header" ref={titleRef} style={styles.title}>
            {options.title}
          </Text>
          {options.message ? (
            <Text style={styles.message}>{options.message}</Text>
          ) : null}
          {options.bullets?.length ? (
            <View style={styles.bullets}>
              {options.bullets.map((bullet) => (
                <View key={bullet} style={styles.bullet}>
                  <View style={styles.bulletMark} />
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.actions}>
          {options.actions.map((action, index) => (
            <PrimaryButton
              key={`${index}:${action.label}`}
              onPress={() => close(index)}
              style={
                action.variant === "danger" && index > 0
                  ? styles.separated
                  : undefined
              }
              variant={action.variant ?? (index === 0 ? "signal" : "quiet")}
            >
              {action.label}
            </PrimaryButton>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

function Toast({
  toast,
  onHidden,
}: {
  toast: ToastOptions & { id: number };
  onHidden(id: number): void;
}) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(toast.message);
    Animated.timing(opacity, {
      toValue: 1,
      duration: motion.standard,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: motion.standard,
        useNativeDriver: true,
      }).start(() => onHidden(toast.id));
    }, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onHidden, opacity, toast.id, toast.message]);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[
        styles.toast,
        {
          bottom: insets.bottom + TOAST_BOTTOM_OFFSET,
          opacity,
          transform: [
            {
              translateY: opacity.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      {toast.tone !== "neutral" ? (
        <Text style={styles.toastMark}>✓</Text>
      ) : null}
      <Text style={styles.toastText}>{toast.message}</Text>
    </Animated.View>
  );
}

/**
 * Still's replacement for the system alert: a bottom sheet with Still's type,
 * colors and buttons, and a toast for confirmations that need no next step.
 * Every action runs after its sheet has left the screen (see sheet-queue).
 */
export function StillSheetProvider({ children }: PropsWithChildren) {
  const queue = useRef<SheetQueueState<SheetOptions>>(emptySheetQueue());
  const nextId = useRef(1);
  const afterDismiss = useRef<(() => void) | null>(null);
  const [sheet, setSheet] = useState<QueuedSheet<SheetOptions> | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [toastState, setToastState] = useState<
    (ToastOptions & { id: number }) | null
  >(null);

  const present = useCallback(() => {
    const visible = queue.current.visible;
    setSheet(visible);
    setModalVisible(Boolean(visible));
  }, []);

  const runAfterDismiss = useCallback(() => {
    const run = afterDismiss.current;
    afterDismiss.current = null;
    run?.();
  }, []);

  const handleClosed = useCallback(
    (choice: SheetChoice) => {
      const { state, settled } = settleSheet(queue.current);
      queue.current = state;
      setModalVisible(false);
      afterDismiss.current = () => {
        setSheet(null);
        for (const listener of settled?.listeners ?? []) listener(choice);
        const action =
          choice === null ? undefined : settled?.options.actions[choice];
        void Promise.resolve()
          .then(() => action?.onPress?.())
          .catch(() => undefined);
        if (queue.current.visible) present();
      };
      // iOS reports the dismissal through onDismiss; the timer covers Android
      // and any platform that never calls it. Whichever comes first wins.
      setTimeout(runAfterDismiss, Platform.OS === "ios" ? 450 : 120);
    },
    [present, runAfterDismiss],
  );

  const show = useCallback(
    (options: SheetOptions) =>
      new Promise<SheetChoice>((resolve) => {
        const idle =
          queue.current.visible === null && afterDismiss.current === null;
        queue.current = enqueueSheet(queue.current, {
          id: nextId.current++,
          key: sheetKey(options.title, options.message),
          options,
          listener: resolve,
        });
        if (idle) present();
      }),
    [present],
  );

  const toast = useCallback((options: ToastOptions) => {
    setToastState({ ...options, id: nextId.current++ });
  }, []);

  const hideToast = useCallback((id: number) => {
    setToastState((current) => (current?.id === id ? null : current));
  }, []);

  const api = useMemo(() => ({ show, toast }), [show, toast]);

  return (
    <SheetContext.Provider value={api}>
      <View style={styles.host}>
        {children}
        {toastState ? (
          <Toast key={toastState.id} onHidden={hideToast} toast={toastState} />
        ) : null}
      </View>
      <Modal
        animationType="none"
        navigationBarTranslucent
        onDismiss={runAfterDismiss}
        onRequestClose={() => {
          // Android back behaves like the backdrop; the sheet decides.
          if (sheet && sheet.options.dismissible !== false) {
            handleClosed(null);
          }
        }}
        statusBarTranslucent
        transparent
        visible={modalVisible}
      >
        {sheet ? (
          <SafeAreaProvider>
            <Sheet
              key={sheet.id}
              onClosed={handleClosed}
              options={sheet.options}
            />
          </SafeAreaProvider>
        ) : null}
      </Modal>
    </SheetContext.Provider>
  );
}

export function useStillSheet(): SheetApi {
  const api = useContext(SheetContext);
  if (!api) throw new Error("useStillSheet must be used inside StillSheetProvider");
  return api;
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(36, 40, 38, 0.4)",
  },
  sheet: {
    backgroundColor: colors.chalkRaised,
    borderTopLeftRadius: radius.modal,
    borderTopRightRadius: radius.modal,
    borderCurve: "continuous",
    boxShadow: shadows.modal,
  },
  grabberZone: {
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.fog,
  },
  scroll: { flexGrow: 0 },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.graphite,
    fontFamily: fonts.brandSemiBold,
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: -0.4,
  },
  message: {
    color: colors.graphiteSoft,
    fontFamily: fonts.brand,
    fontSize: 15,
    lineHeight: 22,
  },
  bullets: { gap: spacing.xs, paddingTop: spacing.xxs },
  bullet: { flexDirection: "row", gap: spacing.sm },
  bulletMark: {
    width: 6,
    height: 6,
    marginTop: 8,
    borderRadius: radius.xs,
    backgroundColor: colors.mineral,
  },
  bulletText: {
    flex: 1,
    color: colors.graphiteSoft,
    fontFamily: fonts.brand,
    fontSize: 14,
    lineHeight: 21,
  },
  actions: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  separated: { marginTop: spacing.sm },
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.surface,
    borderCurve: "continuous",
    backgroundColor: colors.graphite,
    boxShadow: shadows.menu,
  },
  toastMark: {
    color: colors.mineralLight,
    fontFamily: fonts.brandBold,
    fontSize: 15,
  },
  toastText: {
    flex: 1,
    color: colors.chalk,
    fontFamily: fonts.brand,
    fontSize: 15,
    lineHeight: 21,
  },
});
