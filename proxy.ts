import { NextRequest, NextResponse } from "next/server";
import { COOKIE, authDisabled, verify } from "@/lib/session";

// Early redirect only. Route handlers check the session again with currentUser().
export async function proxy(req: NextRequest) {
  if (authDisabled() || (await verify(req.cookies.get(COOKIE)?.value))) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "sign in" }, { status: 401 });
  // Come back to this page after sign-in (the MCP connect flow depends on this).
  const login = new URL("/login", req.url);
  login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
}

// MCP, OAuth API and .well-known routes check their own bearer tokens.
export const config = { matcher: ["/((?!login|api/auth|api/mcp|api/oauth|\\.well-known|_next|favicon.ico).*)"] };
