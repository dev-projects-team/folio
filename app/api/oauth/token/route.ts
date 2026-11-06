import { cidOf, json, preflight, redeemCode, tokenPair } from "@/lib/oauth";
import { isMember, verifyToken, type Via } from "@/lib/session";

const bad = (error: string) => json({ error }, 400);

// Token endpoint: swaps a code (with PKCE) or a refresh token for a new token pair.
// Both paths check the team lists again, so a removed user cannot get new tokens.
export async function POST(req: Request) {
  const f = await req.formData().catch(() => null);
  if (!f) return bad("invalid_request");
  const get = (k: string) => String(f.get(k) ?? "");
  const clientId = get("client_id");

  if (get("grant_type") === "authorization_code") {
    const g = await redeemCode(get("code"), clientId, get("redirect_uri"), get("code_verifier"));
    if (!g || !isMember(g.login, g.via)) return bad("invalid_grant");
    return json(await tokenPair(g));
  }

  if (get("grant_type") === "refresh_token") {
    const r = await verifyToken<{ login: string; via: Via; cid: string; exp: number }>("refresh", get("refresh_token"));
    if (!r || (clientId && r.cid !== cidOf(clientId)) || !isMember(r.login, r.via)) return bad("invalid_grant");
    return json(await tokenPair({ login: r.login, via: r.via, cid: r.cid }));
  }

  return bad("unsupported_grant_type");
}
export const OPTIONS = preflight;
