import { NextRequest, NextResponse } from "next/server";
import { checkPassword } from "@/lib/password";
import { COOKIE, MAX_AGE, safeNext, sign } from "@/lib/session";

// Username + password sign-in. Users and hashes live in the PASSWORD_USERS env var.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const next = safeNext(String(form.get("next") ?? ""));
  const login = checkPassword(String(form.get("username") ?? "").trim(), String(form.get("password") ?? ""));
  if (!login) return NextResponse.redirect(new URL(`/login?error=password&next=${encodeURIComponent(next)}`, req.url), 303);
  const res = NextResponse.redirect(new URL(next, req.url), 303);
  const token = await sign({ login, avatar: "", via: "password", exp: Math.floor(Date.now() / 1000) + MAX_AGE });
  res.cookies.set(COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", maxAge: MAX_AGE, path: "/" });
  return res;
}
