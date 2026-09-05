import {
  requireNativeComponent,
  StyleSheet,
  View,
  type ViewProps,
} from "react-native";

const NativeActivityReport = requireNativeComponent<
  ViewProps & { reportContext: string }
>("StillActivityReportView");

export function ActivityReport({
  context = "still.daily",
}: {
  context?: "still.daily" | "still.weekly";
}) {
  return (
    <View style={styles.frame}>
      <NativeActivityReport reportContext={context} style={styles.report} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { minHeight: 145 },
  report: { flex: 1 },
});
