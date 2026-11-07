import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export type Doc = { content: string; sha: string };
export class Conflict extends Error {}
export class NotFound extends Error {}
export type Snapshot = { docs: Record<string, string>; folders: string[] };
const hidden = (p: string) => p.split("/").some((s) => s.startsWith("."));

export interface Store {
  list(): Promise<string[]>;
  // Every doc (path → sha) and every folder, in one call. The app polls this to see changes from MCP or other people.
  snapshot(): Promise<Snapshot>;
  // Git cannot store an empty folder, so a folder is made with a hidden "folder/.keep" file.
  mkdir(dir: string, author: string): Promise<void>;
  read(p: string): Promise<Doc>;
  write(p: string, content: string, sha: string | null, author: string): Promise<string>;
  remove(p: string, sha: string, author: string): Promise<void>;
  rename(from: string, to: string, author: string): Promise<void>;
}

// ---- Local folder (dev, or a Claude editing a local clone) ----
class LocalStore implements Store {
  constructor(private root: string) {}
  private abs(p: string) {
    const full = path.resolve(this.root, p);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("path outside content dir");
    return full;
  }
  private hash(s: string) {
    return createHash("sha1").update(s).digest("hex");
  }
  async snapshot() {
    const docs: string[] = [], folders: string[] = [];
    const rel = (full: string) => path.relative(this.root, full).split(path.sep).join("/");
    const walk = async (dir: string) => {
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        if (e.name.startsWith(".")) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          folders.push(rel(full));
          await walk(full);
        } else if (e.name.endsWith(".md")) docs.push(rel(full));
      }
    };
    await fs.mkdir(this.root, { recursive: true });
    await walk(this.root);
    docs.sort();
    const shas = await Promise.all(docs.map(async (p) => this.hash(await fs.readFile(this.abs(p), "utf8"))));
    return { docs: Object.fromEntries(docs.map((p, i) => [p, shas[i]])), folders: folders.sort() };
  }
  async list() {
    return Object.keys((await this.snapshot()).docs);
  }
  async mkdir(dir: string) {
    await fs.mkdir(this.abs(dir), { recursive: true });
    await fs.writeFile(this.abs(`${dir}/.keep`), "");
  }
  async read(p: string) {
    try {
      const content = await fs.readFile(this.abs(p), "utf8");
      return { content, sha: this.hash(content) };
    } catch {
      throw new NotFound(p);
    }
  }
  async write(p: string, content: string, sha: string | null) {
    const file = this.abs(p);
    const current = await fs.readFile(file, "utf8").catch(() => null);
    if (sha === null ? current !== null : current === null || this.hash(current) !== sha) throw new Conflict(p);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
    return this.hash(content);
  }
  async remove(p: string, sha: string) {
    const doc = await this.read(p);
    if (doc.sha !== sha) throw new Conflict(p);
    await fs.unlink(this.abs(p));
  }
  async rename(from: string, to: string) {
    if (await fs.stat(this.abs(to)).catch(() => null)) throw new Conflict(to);
    await fs.mkdir(path.dirname(this.abs(to)), { recursive: true });
    await fs.rename(this.abs(from), this.abs(to));
  }
}

// ---- GitHub content repo (production). Every write is one commit on main. ----
class GitHubStore implements Store {
  private api = "https://api.github.com";
  constructor(private repo: string, private token: string, private branch = "main") {}

  private async gh(method: string, url: string, body?: unknown) {
    const r = await fetch(`${this.api}/repos/${this.repo}${url}`, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 404) throw new NotFound(url);
    if (r.status === 409 || r.status === 422) throw new Conflict(url);
    if (!r.ok) throw new Error(`GitHub ${method} ${url}: ${r.status}`);
    return r.json();
  }
  private enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");

  async list() {
    return Object.keys((await this.snapshot()).docs);
  }
  // One tree call gives every folder, every doc, and each doc's blob sha (the same sha read() returns).
  async snapshot() {
    try {
      const t = await this.gh("GET", `/git/trees/${this.branch}?recursive=1`);
      const all = (t.tree as { path: string; type: string; sha: string }[]).filter((e) => !hidden(e.path));
      const docs = all.filter((e) => e.type === "blob" && e.path.endsWith(".md")).sort((a, b) => a.path.localeCompare(b.path));
      return {
        docs: Object.fromEntries(docs.map((e) => [e.path, e.sha])),
        folders: all.filter((e) => e.type === "tree").map((e) => e.path).sort(),
      };
    } catch (e) {
      if (e instanceof NotFound || e instanceof Conflict) return { docs: {}, folders: [] }; // empty repo
      throw e;
    }
  }
  async mkdir(dir: string, author: string) {
    await this.write(`${dir}/.keep`, "", null, author);
  }
  async read(p: string) {
    const f = await this.gh("GET", `/contents/${this.enc(p)}?ref=${this.branch}`);
    return { content: Buffer.from(f.content, "base64").toString("utf8"), sha: f.sha as string };
  }
  async write(p: string, content: string, sha: string | null, author: string) {
    const r = await this.gh("PUT", `/contents/${this.enc(p)}`, {
      message: `${sha ? "Edit" : "Add"} ${p} (by ${author})`,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: this.branch,
      ...(sha ? { sha } : {}),
    });
    return r.content.sha as string;
  }
  async remove(p: string, sha: string, author: string) {
    await this.gh("DELETE", `/contents/${this.enc(p)}`, { message: `Delete ${p} (by ${author})`, sha, branch: this.branch });
  }
  async rename(from: string, to: string, author: string) {
    const doc = await this.read(from);
    await this.write(to, doc.content, null, author);
    await this.remove(from, doc.sha, author);
  }
}

let cached: Store | null = null;
export function store(): Store {
  if (cached) return cached;
  const dir = process.env.CONTENT_DIR;
  if (dir) return (cached = new LocalStore(path.resolve(dir)));
  const repo = process.env.CONTENT_REPO, token = process.env.GITHUB_TOKEN;
  if (!repo || !token) throw new Error("Set CONTENT_DIR, or CONTENT_REPO and GITHUB_TOKEN");
  return (cached = new GitHubStore(repo, token));
}
