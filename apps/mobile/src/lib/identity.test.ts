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
  signInWithIdToken: vi.fn(),
  appleSignInAsync: vi.fn(),
  platform: { OS: "android" as "android" | "ios" },
}));

vi.mock("react-native", () => ({ Platform: mocks.platform }));
vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_algorithm: string, value: string) =>
    `sha256:${value}`,
  randomUUID: () => "raw-nonce",
}));
vi.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: { EMAIL: 1 },
  signInAsync: mocks.appleSignInAsync,
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
      signInWithIdToken: mocks.signInWithIdToken,
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

describe("Apple identity linking", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.platform.OS = "ios";
    mocks.appleSignInAsync.mockResolvedValue({ identityToken: "apple-jwt" });
    mocks.linkIdentity.mockResolvedValue({ data: {}, error: null });
    mocks.getUserIdentities.mockResolvedValue({
      data: { identities: [] },
      error: null,
    });
    mocks.signInWithIdToken.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    mocks.platform.OS = "android";
  });

  it("is offered only on iOS, ahead of Google", async () => {
    process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED = "true";
    const { identityProviders } = await import("./identity");
    expect(identityProviders()).toEqual(["apple", "google"]);
    mocks.platform.OS = "android";
    expect(identityProviders()).toEqual(["google"]);
    delete process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED;
  });

  it("links the Apple ID token with the raw nonce behind the hashed one", async () => {
    const { linkIdentity } = await import("./identity");

    await expect(linkIdentity("apple")).resolves.toBe(true);
    expect(mocks.appleSignInAsync).toHaveBeenCalledWith({
      requestedScopes: [1],
      nonce: "sha256:raw-nonce",
    });
    expect(mocks.linkIdentity).toHaveBeenCalledWith({
      provider: "apple",
      token: "apple-jwt",
      nonce: "raw-nonce",
    });
    expect(mocks.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it("treats a cancelled Apple sheet as not linked", async () => {
    mocks.appleSignInAsync.mockRejectedValue(
      Object.assign(new Error("canceled"), { code: "ERR_REQUEST_CANCELED" }),
    );
    const { linkIdentity } = await import("./identity");

    await expect(linkIdentity("apple")).resolves.toBe(false);
    expect(mocks.linkIdentity).not.toHaveBeenCalled();
  });

  it("recovers the existing account that already owns the Apple ID", async () => {
    mocks.linkIdentity.mockResolvedValue({
      data: {},
      error: { code: "identity_already_exists", message: "exists" },
    });
    const { linkIdentity } = await import("./identity");

    await expect(linkIdentity("apple")).resolves.toBe(true);
    expect(mocks.signInWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "apple-jwt",
      nonce: "raw-nonce",
    });
  });
});

describe("Apple authorization for account deletion", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.platform.OS = "ios";
    mocks.getUserIdentities.mockResolvedValue({
      data: { identities: [{ provider: "anonymous" }, { provider: "apple" }] },
      error: null,
    });
    mocks.appleSignInAsync.mockResolvedValue({ authorizationCode: "code-1" });
  });

  afterEach(() => {
    mocks.platform.OS = "android";
  });

  it("asks Apple for a fresh code, with no personal data, when an Apple ID is linked", async () => {
    const { appleAuthorizationForDeletion } = await import("./identity");
    await expect(appleAuthorizationForDeletion()).resolves.toBe("code-1");
    expect(mocks.appleSignInAsync).toHaveBeenCalledWith({ requestedScopes: [] });
  });

  it("never shows Apple's sheet to accounts without an Apple ID or off iOS", async () => {
    mocks.getUserIdentities.mockResolvedValue({
      data: { identities: [{ provider: "google" }] },
      error: null,
    });
    const { appleAuthorizationForDeletion } = await import("./identity");
    await expect(appleAuthorizationForDeletion()).resolves.toBeNull();
    mocks.platform.OS = "android";
    await expect(appleAuthorizationForDeletion()).resolves.toBeNull();
    expect(mocks.appleSignInAsync).not.toHaveBeenCalled();
  });

  it("lets deletion go on when the person closes the sheet or it fails", async () => {
    mocks.appleSignInAsync.mockRejectedValueOnce(
      Object.assign(new Error("canceled"), { code: "ERR_REQUEST_CANCELED" }),
    );
    mocks.appleSignInAsync.mockRejectedValueOnce(new Error("unknown"));
    const { appleAuthorizationForDeletion } = await import("./identity");
    await expect(appleAuthorizationForDeletion()).resolves.toBeNull();
    await expect(appleAuthorizationForDeletion()).resolves.toBeNull();
  });
});
