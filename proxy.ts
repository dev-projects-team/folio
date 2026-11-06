import { NextRequest, NextResponse } from "next/server";
import { COOKIE, authDisabled, verify } from "@/lib/session";

// Early redirect only. Route handlers check the session again with currentUser().
export async function proxy(req: NextRequest) {
  if (authDisabled() || (await verify(req.cookies.get(COOKIE)?.value))) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "sign in" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/((?!login|api/auth|_next|favicon.ico).*)"] };
