import type { Href } from "expo-router";

import { getJson, setJson } from "./storage";

/**
 * Where the "<App> is connected" screen of a setup test goes back to. The test
 * opens the app under test, so the screen that started it is gone by the time
 * the automation brings Still back; whoever starts a test says where to return
 * (the setup screen by default, or a step of the onboarding).
 */
export type SetupTestReturn = {
  pathname: string;
  params?: Record<string, string>;
};

const KEY = "shortcutSetupTestReturn";

export const DEFAULT_SETUP_TEST_RETURN: SetupTestReturn = { pathname: "/shortcut-setup" };

export async function rememberSetupTestReturn(value: SetupTestReturn | null) {
  await setJson(KEY, value);
}

/** The route to show after a test, carrying the connected app's name. */
export async function setupTestReturnHref(testedApp: string): Promise<Href> {
  const target =
    (await getJson<SetupTestReturn | null>(KEY, null).catch(() => null)) ??
    DEFAULT_SETUP_TEST_RETURN;
  return {
    pathname: target.pathname,
    params: { ...target.params, tested: testedApp },
  } as Href;
}
