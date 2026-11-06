// Signed session cookie. HMAC-SHA256 with Web Crypto, so it works in proxy and in route handlers.
export const COOKIE = "folio_session";
export const MAX_AGE = 60 * 60 * 24 * 30;

export type Session = { login: string; avatar: string; exp: number };

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");

async function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function sign(s: Session): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(s)));
  const sig = await crypto.subtle.sign("HMAC", await key(), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verify(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", await key(), Buffer.from(sig, "base64url"), enc.encode(body));
  if (!ok) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    return s.exp > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}

export const authDisabled = () => process.env.AUTH_DISABLED === "1" && process.env.NODE_ENV !== "production";
export const DEV_SESSION: Session = { login: "local-dev", avatar: "", exp: 4102444800 };

export function allowed(login: string): boolean {
  const list = (process.env.ALLOWED_GITHUB_USERS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(login.toLowerCase());
}
