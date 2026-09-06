import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  beginExternalAuthSession: vi.fn(),
  endExternalAuthSession: vi.fn(),
  openBrowserAsync: vi.fn(),
  platform: { OS: "android" },
  remove: vi.fn(),
}));

vi.mock("expo-web-browser", () => ({
  openBrowserAsync: mocks.openBrowserAsync,
}));
vi.mock("react-native", () => ({
  AppState: { addEventListener: mocks.addEventListener },
  Platform: mocks.platform,
}));
vi.mock("@/native/restriction-engine", () => ({
  restrictionEngine: {
    beginExternalAuthSession: mocks.beginExternalAuthSession,
    endExternalAuthSession: mocks.endExternalAuthSession,
  },
}));

describe("protected external browser links", () => {
  let onAppStateChange: (state: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.platform.OS = "android";
    mocks.beginExternalAuthSession.mockResolvedValue(undefined);
    mocks.endExternalAuthSession.mockResolvedValue(undefined);
    mocks.addEventListener.mockImplementation(
      (_event: string, listener: (state: string) => void) => {
        onAppStateChange = listener;
        return { remove: mocks.remove };
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps Android browsers exempt until the user returns to Still", async () => {
    mocks.openBrowserAsync.mockResolvedValue({ type: "opened" });
    const { openExternalBrowser } = await import("./external-browser");

    const opened = openExternalBrowser("https://cruzroja.org.uy/acerca-de/");
    await vi.waitFor(() => expect(mocks.openBrowserAsync).toHaveBeenCalled());
    expect(mocks.endExternalAuthSession).not.toHaveBeenCalled();

    onAppStateChange("background");
    onAppStateChange("active");
    await opened;

    expect(mocks.beginExternalAuthSession).toHaveBeenCalledOnce();
    expect(mocks.endExternalAuthSession).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it("restores iOS shields when its in-app browser closes", async () => {
    mocks.platform.OS = "ios";
    mocks.openBrowserAsync.mockResolvedValue({ type: "dismiss" });
    const { openExternalBrowser } = await import("./external-browser");

    await openExternalBrowser("https://www.karumbe.org/");

    expect(mocks.beginExternalAuthSession).toHaveBeenCalledOnce();
    expect(mocks.endExternalAuthSession).toHaveBeenCalledOnce();
  });

  it("restores protection when the browser cannot open", async () => {
    mocks.openBrowserAsync.mockRejectedValue(new Error("browser failed"));
    const { openExternalBrowser } = await import("./external-browser");

    await expect(
      openExternalBrowser("https://perezscremini.org/la-fundacion/"),
    ).rejects.toThrow("browser failed");

    expect(mocks.endExternalAuthSession).toHaveBeenCalledOnce();
  });

  it("rejects insecure links before changing native protection", async () => {
    const { openExternalBrowser } = await import("./external-browser");

    await expect(openExternalBrowser("http://example.com")).rejects.toThrow(
      "Only secure external links are allowed",
    );

    expect(mocks.beginExternalAuthSession).not.toHaveBeenCalled();
    expect(mocks.openBrowserAsync).not.toHaveBeenCalled();
  });
});
