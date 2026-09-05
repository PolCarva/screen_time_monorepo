import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  beginExternalAuthSession: vi.fn(),
  endExternalAuthSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getUserIdentities: vi.fn(),
  linkIdentity: vi.fn(),
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn(),
  refreshSession: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock("expo-auth-session", () => ({
  makeRedirectUri: () => "still://auth/callback",
}));
vi.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: mocks.maybeCompleteAuthSession,
  openAuthSessionAsync: mocks.openAuthSessionAsync,
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getUserIdentities: mocks.getUserIdentities,
      linkIdentity: mocks.linkIdentity,
      refreshSession: mocks.refreshSession,
      signInWithOAuth: mocks.signInWithOAuth,
    },
  },
}));
vi.mock("@/native/restriction-engine", () => ({
  restrictionEngine: {
    beginExternalAuthSession: mocks.beginExternalAuthSession,
    endExternalAuthSession: mocks.endExternalAuthSession,
  },
}));

describe("Google identity linking", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED = "true";
    mocks.beginExternalAuthSession.mockResolvedValue(undefined);
    mocks.endExternalAuthSession.mockResolvedValue(undefined);
    mocks.linkIdentity.mockResolvedValue({
      data: {
        url: "https://accounts.google.com/oauth",
        flowId: "pkce-flow-id",
      },
      error: null,
    });
    mocks.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    mocks.getUserIdentities.mockResolvedValue({
      data: { identities: [] },
      error: null,
    });
    mocks.refreshSession.mockResolvedValue({ data: {}, error: null });
    mocks.signInWithOAuth.mockResolvedValue({
      data: {
        url: "https://accounts.google.com/recover",
        flowId: "recovery-flow-id",
      },
      error: null,
    });
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED;
  });

  it("temporarily bypasses the protected browser and restores it after success", async () => {
    mocks.openAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "still://auth/callback?code=auth-code",
    });
    const { linkIdentity } = await import("./identity");

    await expect(linkIdentity("google")).resolves.toBe(true);

    expect(mocks.beginExternalAuthSession).toHaveBeenCalledOnce();
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("auth-code", {
      flowId: "pkce-flow-id",
    });
    expect(mocks.endExternalAuthSession).toHaveBeenCalledOnce();
    expect(
      mocks.beginExternalAuthSession.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.openAuthSessionAsync.mock.invocationCallOrder[0]);
    expect(mocks.openAuthSessionAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.endExternalAuthSession.mock.invocationCallOrder[0],
    );
  });

  it("restores browser protection when the user cancels", async () => {
    mocks.openAuthSessionAsync.mockResolvedValue({ type: "cancel" });
    const { linkIdentity } = await import("./identity");

    await expect(linkIdentity("google")).resolves.toBe(false);

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(mocks.endExternalAuthSession).toHaveBeenCalledOnce();
  });

  it("restores browser protection when opening OAuth fails", async () => {
    mocks.openAuthSessionAsync.mockRejectedValue(new Error("browser failed"));
    const { linkIdentity } = await import("./identity");

    await expect(linkIdentity("google")).rejects.toThrow("browser failed");
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(mocks.endExternalAuthSession).toHaveBeenCalledOnce();
  });

  it("surfaces an OAuth callback error without trying to exchange it", async () => {
    mocks.openAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "still://auth/callback?error=access_denied&error_description=Google+sign-in+was+denied",
    });
    const { linkIdentity } = await import("./identity");

    await expect(linkIdentity("google")).rejects.toThrow(
      "Google sign-in was denied",
    );
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(mocks.endExternalAuthSession).toHaveBeenCalledOnce();
  });

  it("signs into an existing Still account when Google is already registered", async () => {
    mocks.openAuthSessionAsync
      .mockResolvedValueOnce({
        type: "success",
        url: "still://auth/callback?error=server_error&error_code=email_exists&error_description=A+user+with+this+email+address+has+already+been+registered",
      })
      .mockResolvedValueOnce({
        type: "success",
        url: "still://auth/callback?code=recovery-code",
      });
    const { linkIdentity } = await import("./identity");

    await expect(linkIdentity("google")).resolves.toBe(true);

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "still://auth/callback",
        skipBrowserRedirect: true,
      },
    });
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("recovery-code", {
      flowId: "recovery-flow-id",
    });
    expect(mocks.beginExternalAuthSession).toHaveBeenCalledOnce();
    expect(mocks.endExternalAuthSession).toHaveBeenCalledOnce();
  });

  it("recovers a Google identity that the provider linked before an earlier client failed", async () => {
    mocks.openAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "still://auth/callback?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked",
    });
    mocks.getUserIdentities.mockResolvedValue({
      data: { identities: [{ provider: "google" }] },
      error: null,
    });
    const { linkIdentity } = await import("./identity");

    await expect(linkIdentity("google")).resolves.toBe(true);

    expect(mocks.refreshSession).toHaveBeenCalledOnce();
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(mocks.endExternalAuthSession).toHaveBeenCalledOnce();
  });

  it("accepts the server-side identity when callback exchange fails locally", async () => {
    mocks.openAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "still://auth/callback?code=stale-client-code",
    });
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: {},
      error: new Error("PKCE verifier was not found"),
    });
    mocks.getUserIdentities.mockResolvedValue({
      data: { identities: [{ provider: "google" }] },
      error: null,
    });
    const { linkIdentity } = await import("./identity");

    await expect(linkIdentity("google")).resolves.toBe(true);

    expect(mocks.refreshSession).toHaveBeenCalledOnce();
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("recovers when Supabase reports the identity before opening the browser", async () => {
    mocks.linkIdentity.mockResolvedValue({
      data: { url: null, flowId: null },
      error: Object.assign(new Error("Identity is already linked"), {
        code: "identity_already_exists",
      }),
    });
    mocks.getUserIdentities.mockResolvedValue({
      data: { identities: [{ provider: "google" }] },
      error: null,
    });
    const { linkIdentity } = await import("./identity");

    await expect(linkIdentity("google")).resolves.toBe(true);

    expect(mocks.openAuthSessionAsync).not.toHaveBeenCalled();
    expect(mocks.refreshSession).toHaveBeenCalledOnce();
    expect(mocks.endExternalAuthSession).toHaveBeenCalledOnce();
  });
});
