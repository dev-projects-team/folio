// A doc path is relative, ends in .md, and only uses safe characters. No "..", no hidden files.
const SAFE = /^[A-Za-z0-9 _\-.\/]+$/;

export function cleanPath(input: string): string | null {
  const p = input.trim().replace(/\/+/g, "/");
  if (!p || !SAFE.test(p) || !p.endsWith(".md")) return null;
  const parts = p.split("/");
  if (parts.some((s) => s === "" || s.startsWith(".") || s === "..")) return null;
  return parts.join("/");
}

export function titleOf(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.md$/, "");
}
