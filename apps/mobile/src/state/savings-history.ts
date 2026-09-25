import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { SAVINGS_PERIOD_DAYS, type SavingsHistory } from "@/lib/savings";
import { restrictionEngine } from "@/native/restriction-engine";

/**
 * Still's counters per day and per app for the longest period the Savings
 * screen offers, read on focus and on return. Every filter is worked out
 * from this one read. Null while loading; empty on builds without it.
 */
export function useSavingsHistory() {
  const [history, setHistory] = useState<SavingsHistory | null>(null);
  const refresh = useCallback(async () => {
    const next = await restrictionEngine
      .getAppHistory?.(SAVINGS_PERIOD_DAYS.all)
      .catch(() => null);
    setHistory(next ?? { days: [], apps: [] });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return history;
}
