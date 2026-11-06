import "server-only";
import { cookies } from "next/headers";
import { COOKIE, DEV_SESSION, authDisabled, verify, type Session } from "./session";

// Full check for route handlers and pages (proxy only does an early redirect).
export async function currentUser(): Promise<Session | null> {
  if (authDisabled()) return DEV_SESSION;
  return verify((await cookies()).get(COOKIE)?.value);
}
