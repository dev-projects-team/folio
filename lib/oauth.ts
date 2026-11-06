import "server-only";
import { createHash } from "node:crypto";
import { signToken, verifyToken, type Via } from "./session";

// A tiny OAuth 2.1 server for MCP clients (Claude, ChatGPT). It keeps no database:
// client ids, codes and tokens are all signed with SESSION_SECRET.
// ponytail: stateless codes can be replayed for 5 minutes; PKCE still binds them to the client
// that started the flow. Add a store (Neon/Redis) if we ever need one-time codes or token revoke.

export const ACCESS_TTL = 60 * 60; // 1 hour
export const REFRESH_TTL = 60 * 60 * 24 * 30; // 30 days
const CODE_TTL = 5 * 60;

export const issuer = (req: Request) => (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
const now = () => Math.floor(Date.now() / 1000);

export type Client = { r: string[]; n: string };
export type Grant = { login: string; via: Via; cid: string; exp: number };

// Redirect URIs must be https, or http on this machine (for Claude Code and other local clients).
export function okRedirect(uri: unknown): uri is string {
  try {
    const u = new URL(String(uri));
    return !u.hash && (u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)));
  } catch {
    return false;
  }
}

export const registerClient = (redirectUris: string[], name: string) => signToken("client", { r: redirectUris, n: name.slice(0, 80) });

// The client, but only if `redirectUri` is one it registered.
export async function clientFor(clientId: string, redirectUri: string): Promise<Client | null> {
  const c = await verifyToken<Client & { exp?: number }>("client", clientId);
  return c && c.r.includes(redirectUri) ? c : null;
}

// Short id for a client, so codes and tokens do not carry the long client id.
export const cidOf = (clientId: string) => createHash("sha256").update(clientId).digest("base64url").slice(0, 22);

export const issueCode = (g: Omit<Grant, "exp">, redirectUri: string, challenge: string) =>
  signToken("code", { ...g, r: redirectUri, ch: challenge, exp: now() + CODE_TTL });

export async function redeemCode(code: string, clientId: string, redirectUri: string, verifier: string) {
  const c = await verifyToken<Grant & { r: string; ch: string }>("code", code);
  if (!c || c.cid !== cidOf(clientId) || c.r !== redirectUri) return null;
  const s256 = createHash("sha256").update(verifier).digest("base64url");
  return s256 === c.ch ? { login: c.login, via: c.via, cid: c.cid } : null;
}

export async function tokenPair(g: Omit<Grant, "exp">) {
  return {
    access_token: await signToken("access", { ...g, exp: now() + ACCESS_TTL }),
    refresh_token: await signToken("refresh", { ...g, exp: now() + REFRESH_TTL }),
    token_type: "Bearer",
    expires_in: ACCESS_TTL,
    scope: "docs",
  };
}

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
export const preflight = () => new Response(null, { status: 204, headers: CORS });
