// Renews the AdMob Reporting refresh token and stores it in Supabase Vault,
// where the daily revenue import reads it (docs/runbook.md). From apps/web:
//
//   pnpm admob:connect             opens Google's consent page
//   pnpm admob:connect --no-open   only prints the link
//
// The token goes from Google to Vault inside this process and is never
// printed, so nobody has to paste it into Vercel or anywhere else.
import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

import { createClient } from "@supabase/supabase-js";

const SCOPE = "https://www.googleapis.com/auth/admob.readonly";
const TIMEOUT_MS = 5 * 60_000;

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is missing from apps/web/.env.local`);
    process.exit(1);
  }
  return value;
}

const clientId = required("ADMOB_CLIENT_ID");
const clientSecret = required("ADMOB_CLIENT_SECRET");
const publisherId = required("ADMOB_PUBLISHER_ACCOUNT").replace(/^accounts\//, "");
const supabase = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const verifier = randomBytes(48).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const state = randomBytes(24).toString("base64url");

async function exchange(code, redirectUri) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(`Google refused the code (${body.error ?? response.status})`);
  if (!body.refresh_token)
    throw new Error("Google returned no refresh token; run the command again");
  return body;
}

/** Refuses a token from a Google account that cannot read this publisher. */
async function assertPublisher(accessToken) {
  const response = await fetch("https://admob.googleapis.com/v1/accounts", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`The AdMob API refused the token (${response.status})`);
  const publishers = (body.account ?? []).map((account) => account.publisherId);
  if (!publishers.includes(publisherId))
    throw new Error(`This Google account cannot read ${publisherId}; use the AdMob owner`);
}

async function store(refreshToken) {
  const { error } = await supabase.rpc("set_admob_refresh_token", {
    p_token: refreshToken,
  });
  if (error) throw new Error(`Supabase did not store the token (${error.message})`);
}

const timer = setTimeout(() => {
  console.error("Google did not answer within 5 minutes; run the command again.");
  process.exitCode = 1;
  server.close();
}, TIMEOUT_MS);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname !== "/") {
    response.writeHead(404).end();
    return;
  }
  const finish = (status, message, exitCode) => {
    response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
    response.end(
      `<!doctype html><meta charset="utf-8"><title>Still · AdMob</title>` +
        `<p style="font:16px system-ui;margin:3rem">${message}</p>`,
    );
    clearTimeout(timer);
    process.exitCode = exitCode;
    server.close();
  };

  if (url.searchParams.get("state") !== state) {
    finish(400, "Este enlace no corresponde a este intento. Vuelve a correr el comando.", 1);
    return;
  }
  const refusal = url.searchParams.get("error");
  if (refusal) {
    console.error(`Google did not grant access (${refusal})`);
    finish(400, "Google no dio acceso. Vuelve a correr el comando.", 1);
    return;
  }
  try {
    const tokens = await exchange(url.searchParams.get("code") ?? "", redirectUri);
    await assertPublisher(tokens.access_token);
    await store(tokens.refresh_token);
    console.log(`AdMob connected: the refresh token for ${publisherId} is stored in Vault.`);
    finish(200, "Listo: AdMob quedó conectado. Ya puedes cerrar esta pestaña.", 0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    finish(500, "No se pudo conectar AdMob. El motivo está en la terminal.", 1);
  }
});

let redirectUri = "";
server.listen(0, "127.0.0.1", () => {
  redirectUri = `http://127.0.0.1:${server.address().port}/`;
  const consent = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  consent.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...(process.env.ADMOB_LOGIN_HINT ? { login_hint: process.env.ADMOB_LOGIN_HINT } : {}),
  }).toString();
  console.log(`Authorize Still with the AdMob owner's Google account:\n${consent}`);
  if (!process.argv.includes("--no-open"))
    execFile(process.platform === "darwin" ? "open" : "xdg-open", [consent], () => {});
});
