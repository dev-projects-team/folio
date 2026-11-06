import { NextRequest, NextResponse } from "next/server";
import { COOKIE, MAX_AGE, allowed, sign } from "@/lib/session";

const fail = (req: NextRequest, why: string) => NextResponse.redirect(new URL(`/login?error=${why}`, req.url));

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || state !== req.cookies.get("folio_oauth_state")?.value) return fail(req, "state");

  const tok = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }),
  }).then((r) => r.json());
  if (!tok.access_token) return fail(req, "token");

  const user = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tok.access_token}`, Accept: "application/vnd.github+json" },
  }).then((r) => r.json());
  if (!user.login || !allowed(user.login)) return fail(req, "not-allowed");

  const res = NextResponse.redirect(new URL("/", req.url));
  const token = await sign({ login: user.login, avatar: user.avatar_url ?? "", exp: Math.floor(Date.now() / 1000) + MAX_AGE });
  res.cookies.set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", maxAge: MAX_AGE, path: "/" });
  res.cookies.delete("folio_oauth_state");
  return res;
}
