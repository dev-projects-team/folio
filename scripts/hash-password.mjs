// Usage: pnpm hash-password <username> <password>
// Prints one PASSWORD_USERS entry. Join several with commas.
import { randomBytes, scryptSync } from "node:crypto";

const [name, password] = process.argv.slice(2);
if (!name || !password || !/^[A-Za-z0-9_-]+$/.test(name)) {
  console.error("Usage: pnpm hash-password <username> <password>   (username: letters, numbers, - _)");
  process.exit(1);
}
const salt = randomBytes(16).toString("hex");
console.log(`${name}:${salt}:${scryptSync(password, salt, 32).toString("hex")}`);
