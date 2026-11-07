import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { cleanPath } from "@/lib/paths";
import { isMember, verifyToken, type Via } from "@/lib/session";
import { Conflict, NotFound, store } from "@/lib/store";

const INSTRUCTIONS = `Folio is the team's shared docs. Each doc is a Markdown file; folders are directories.
- Paths are relative and end in .md, e.g. "reels/day-3-plan.md". Use letters, numbers, spaces, - _ . and / only.
- Folders are plain containers with no page of their own. Writing "folder/doc.md" creates the folder.
- Use plain Markdown: headings, lists, checkboxes, links, code, and GitHub tables (| a | b |). No YAML front-matter or HTML; the editor drops them.
- To change a doc: read_doc first, then write_doc with the sha you read. If it fails with a conflict, read again and merge.
- Every write is a git commit in the signed-in user's name, so keep edits focused.`;

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (t: string) => ({ content: [{ type: "text" as const, text: t }], isError: true });

// Runs one tool body with a checked path and the user's login; turns store errors into plain messages.
async function run(raw: string, authInfo: AuthInfo | undefined, fn: (p: string, login: string) => Promise<ReturnType<typeof text>>) {
  const login = String(authInfo?.extra?.login ?? "");
  const p = cleanPath(raw);
  if (!login) return fail("Not signed in.");
  if (!p) return fail(`Bad path "${raw}". It must be relative, end in .md and use only letters, numbers, spaces, - _ . /`);
  try {
    return await fn(p, login);
  } catch (e) {
    if (e instanceof NotFound) return fail(`No doc at ${p}.`);
    if (e instanceof Conflict) return fail(`Conflict at ${p}: the doc changed since you read it, or the target exists. Read it again.`);
    throw e;
  }
}

const docPath = z.string().describe('Doc path, for example "reels/day-3-plan.md"');

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_docs",
      { title: "List docs", description: "List every doc path. Folders are the path prefixes.", inputSchema: z.object({}) },
      async () => text((await store().list()).join("\n") || "(no docs yet)"),
    );

    server.registerTool(
      "read_doc",
      { title: "Read doc", description: "Read one doc. Returns its sha (needed to edit or delete) and its Markdown.", inputSchema: z.object({ path: docPath }) },
      async ({ path }, ctx) => run(path, ctx.http?.authInfo, async (p) => {
        const d = await store().read(p);
        return text(`sha: ${d.sha}\n\n${d.content}`);
      }),
    );

    server.registerTool(
      "search_docs",
      {
        title: "Search docs",
        description: "Find docs whose path or text contains the query (case-insensitive). Returns matching lines.",
        inputSchema: z.object({ query: z.string().min(2) }),
      },
      async ({ query }) => {
        const q = query.toLowerCase();
        // ponytail: reads every doc per search; fine for a few hundred docs. Add an index if it gets slow.
        const paths = (await store().list()).slice(0, 300);
        const hits = await Promise.all(paths.map(async (p) => {
          const lines = (await store().read(p).catch(() => ({ content: "" }))).content.split("\n").filter((l) => l.toLowerCase().includes(q));
          return lines.length || p.toLowerCase().includes(q) ? `## ${p}\n${lines.slice(0, 5).join("\n")}` : null;
        }));
        return text(hits.filter(Boolean).join("\n\n") || "No matches.");
      },
    );

    server.registerTool(
      "write_doc",
      {
        title: "Create or update doc",
        description: "Create a doc (omit sha) or replace a doc's whole Markdown (pass the sha from read_doc).",
        inputSchema: z.object({ path: docPath, content: z.string(), sha: z.string().optional().describe("sha from read_doc; omit to create a new doc") }),
      },
      async ({ path, content, sha }, ctx) => run(path, ctx.http?.authInfo, async (p, login) =>
        text(`Saved ${p}. New sha: ${await store().write(p, content, sha ?? null, login)}`)),
    );

    server.registerTool(
      "move_doc",
      { title: "Rename or move doc", description: "Rename a doc or move it to another folder.", inputSchema: z.object({ path: docPath, to: docPath }) },
      async ({ path, to }, ctx) => run(path, ctx.http?.authInfo, async (p, login) => {
        const dest = cleanPath(to);
        if (!dest) return fail(`Bad target path "${to}".`);
        await store().rename(p, dest, login);
        return text(`Moved ${p} to ${dest}.`);
      }),
    );

    server.registerTool(
      "delete_doc",
      { title: "Delete doc", description: "Delete a doc. It stays in git history.", inputSchema: z.object({ path: docPath, sha: z.string() }) },
      async ({ path, sha }, ctx) => run(path, ctx.http?.authInfo, async (p, login) => {
        await store().remove(p, sha, login);
        return text(`Deleted ${p}.`);
      }),
    );
  },
  { serverInfo: { name: "folio", version: "1.0.0" }, instructions: INSTRUCTIONS },
);

// Only signed-in team members: the token comes from Folio's own OAuth flow (/oauth/authorize),
// and the team lists are checked on every call.
async function verify(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  const t = await verifyToken<{ login: string; via: Via; cid: string; exp: number }>("access", bearer);
  if (!t || !isMember(t.login, t.via)) return undefined;
  return { token: bearer!, clientId: t.cid, scopes: ["docs"], expiresAt: t.exp, extra: { login: t.login } };
}

const authed = withMcpAuth(handler, verify, { required: true });
export { authed as GET, authed as POST, authed as DELETE };
