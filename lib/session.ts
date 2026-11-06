// Signed tokens: HMAC-SHA256 with Web Crypto, so they work in proxy and in route handlers.
// The same key signs session cookies and MCP OAuth tokens. The `kind` is part of the
// signed bytes, so a token of one kind never verifies as another kind.
export const COOKIE = "folio_session";
export const MAX_AGE = 60 * 60 * 24 * 30;

export type Via = "github" | "password";
export type Session = { login: string; avatar: string; via: Via; exp: number };
export type Kind = "session" | "client" | "code" | "access" | "refresh";

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");

async function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signToken(kind: Kind, payload: object): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await key(), enc.encode(`${kind}.${body}`));
  return `${body}.${b64url(sig)}`;
}

// Returns the payload if the signature is valid and `exp` (if set) is in the future.
export async function verifyToken<T extends { exp?: number }>(kind: Kind, token: string | undefined): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", await key(), Buffer.from(sig, "base64url"), enc.encode(`${kind}.${body}`));
  if (!ok) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as T;
    return p.exp === undefined || p.exp > Date.now() / 1000 ? p : null;
  } catch {
    return null;
  }
}

export const sign = (s: Session) => signToken("session", s);

// A session is valid only while its user is still on the team list, so removing
// someone from the env list signs them out on their next request.
export async function verify(token: string | undefined): Promise<Session | null> {
  const s = await verifyToken<Session>("session", token);
  return s && isMember(s.login, s.via) ? s : null;
}

export const authDisabled = () => process.env.AUTH_DISABLED === "1" && process.env.NODE_ENV !== "production";
export const DEV_SESSION: Session = { login: "local-dev", avatar: "", via: "password", exp: 4102444800 };

const csv = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

// GitHub users: ALLOWED_GITHUB_USERS=name1,name2 (case-insensitive).
export function allowed(login: string): boolean {
  return csv(process.env.ALLOWED_GITHUB_USERS).some((u) => u.toLowerCase() === login.toLowerCase());
}

// Password users: PASSWORD_USERS=name:salt:hash,... (make an entry with `pnpm hash-password`).
export function passwordEntry(login: string): { name: string; salt: string; hash: string } | null {
  for (const e of csv(process.env.PASSWORD_USERS)) {
    const [name, salt, hash] = e.split(":");
    if (name && salt && hash && name.toLowerCase() === login.toLowerCase()) return { name, salt, hash };
  }
  return null;
}

// GitHub and password names are separate lists, so a GitHub account can never take over a password user's name.
export function isMember(login: string, via: Via): boolean {
  if (authDisabled()) return true;
  return via === "github" ? allowed(login) : passwordEntry(login) !== null;
}

// Only same-site relative paths. Blocks "//evil.com" and "/\evil.com".
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
