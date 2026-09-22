import * as WebBrowser from "expo-web-browser";
import { AppState, Platform } from "react-native";

import { restrictionEngine } from "@/native/restriction-engine";

const EXTERNAL_BROWSER_TIMEOUT_MS = 10 * 60 * 1_000;

function externalHttpsUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:")
    throw new Error("Only secure external links are allowed");
  return url.toString();
}

/**
 * Opens a user-requested HTTPS page without Still immediately intercepting
 * the browser selected to display it. Android restores the restriction when
 * Still becomes active again; iOS restores it when the in-app browser closes.
 * Native code also enforces the same bounded timeout if JS is suspended.
 */
export async function openExternalBrowser(value: string): Promise<void> {
  const url = externalHttpsUrl(value);
  await restrictionEngine.beginExternalAuthSession?.();

  return new Promise((resolve, reject) => {
    let leftStill = false;
    let finishing = false;
    let timeout: ReturnType<typeof setTimeout>;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        leftStill = true;
      } else if (leftStill) {
        void finish();
      }
    });

    async function finish(error?: unknown) {
      if (finishing) return;
      finishing = true;
      clearTimeout(timeout);
      subscription.remove();
      try {
        await restrictionEngine.endExternalAuthSession?.();
        if (error) reject(error);
        else resolve();
      } catch (restoreError) {
        reject(error ?? restoreError);
      }
    }

    timeout = setTimeout(() => void finish(), EXTERNAL_BROWSER_TIMEOUT_MS);

    void WebBrowser.openBrowserAsync(url).then(
      (result) => {
        // Android reports `opened` as soon as its Custom Tab starts, so the
        // AppState transition owns restoration there. iOS resolves only after
        // its in-app browser has been dismissed.
        if (Platform.OS !== "android" || result.type !== "opened") {
          void finish();
        }
      },
      (error) => void finish(error),
    );
  });
}
