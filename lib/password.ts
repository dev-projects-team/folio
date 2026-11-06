import "server-only";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { passwordEntry } from "./session";

// Same parameters as scripts/hash-password.mjs.
const LEN = 32;
// An unknown user is checked against a dummy hash, so it costs the same time as a known one.
const DUMMY = { name: "", salt: "0".repeat(32), hash: scryptSync("x", "0".repeat(32), LEN).toString("hex") };

// Returns the user's name as written in PASSWORD_USERS, or null.
export function checkPassword(login: string, password: string): string | null {
  const entry = login ? passwordEntry(login) : null;
  const e = entry ?? DUMMY;
  const want = Buffer.from(e.hash, "hex");
  const ok = want.length === LEN && timingSafeEqual(scryptSync(password, e.salt, LEN), want);
  return ok && entry ? entry.name : null;
}
