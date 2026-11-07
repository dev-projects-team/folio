# Folio — team docs, v1 spec

A private docs app for 5 people. It looks like Notion: a sidebar of folders and docs, and a block editor.
Docs are Markdown files in a git repo, so every teammate's Claude can read and edit them directly.

## Goals (v1)
1. See all docs in a sidebar tree (folders + docs), filter by title.
2. Create, edit, rename and delete docs. Create folders.
3. Edit in a Notion-style block editor (BlockNote). Save with the button or Cmd+S.
4. Every save is a git commit in the content repo, with the editor's GitHub name in the message.
5. Only team members can sign in: allowed GitHub users, or username + password users.
6. Claude and ChatGPT connect through an MCP server with OAuth sign-in.

## Non-goals (v1)
Permission matrix, comments, real-time co-editing, AI inside the app, mobile app, file uploads, dashboards (v2).

## Layout
| Part | What |
|---|---|
| App repo | `dev-projects-team/folio` (this folder). Next.js 16 App Router, TypeScript, Tailwind 4, pnpm |
| Content repo | `dev-projects-team/folio-content`. Only `.md` files. Folders = directories. |
| Editor | `@blocknote/react` + `@blocknote/mantine`. Markdown in/out with BlockNote's converters |
| Hosting | Vercel Hobby (free). Not deployed until Logesh asks |

## Storage (`lib/store.ts`)
One interface, two backends, chosen by env:
- `CONTENT_DIR` set → local files (dev, and for a Claude working on a local clone).
- else GitHub Contents API on `CONTENT_REPO` (`owner/name`, branch `main`) with `GITHUB_TOKEN` (fine-grained, contents read/write on the content repo only).

Operations: `list()` (recursive tree, `.md` only), `read(path)` → `{content, sha}`, `write(path, content, sha|null, author)`, `remove(path, sha, author)`, `rename(from, to, author)`.
- Paths are validated: relative, no `..`, no leading `/` or `.`, end in `.md`, characters `[A-Za-z0-9 _\-./]`.
- `write` sends the `sha` the editor loaded. If the file changed since, GitHub returns 409/422 → the app shows "Changed by someone else. Reload." Last-write never silently overwrites.
- Folders are plain containers (no folder page). Git has no empty folders, so "new folder" creates a hidden `folder/.keep`.
- `snapshot()` returns every doc (path → sha) and every folder in one call. The sidebar polls it every 15s, so MCP edits show without a reload.

## Auth
- GitHub OAuth app (owned by the org). Routes `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`.
- Allowlist: `ALLOWED_GITHUB_USERS` (comma-separated, case-insensitive).
- Password users: `PASSWORD_USERS=name:salt:scrypthash,...` (make entries with `pnpm hash-password`). Route `POST /api/auth/password`.
  The two lists are separate: a GitHub account can never sign in as a password user.
- Session: HMAC-SHA256 signed cookie (`SESSION_SECRET`), `httpOnly`, `secure`, `sameSite=lax`, 30 days. Payload: login, avatar, via (github|password), expiry.
- Every session and MCP token is checked against the lists on each request. Remove a user from the env var to revoke them.
- `proxy.ts` blocks every page and API route without a valid session, except `/login` and `/api/auth/*`.
- `AUTH_DISABLED=1` only works when `NODE_ENV !== 'production'` (local dev).

## Env
`CONTENT_DIR` | `CONTENT_REPO`, `GITHUB_TOKEN` · `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `ALLOWED_GITHUB_USERS`, `APP_URL` · `AUTH_DISABLED` (dev only). Secrets only in `.env.local` / Vercel env, never in git.

## Routes
- `/` → sidebar + welcome (recent list not in v1).
- `/d/[...path]` → doc editor.
- `/api/docs` GET tree · POST create `{path, content}`.
- `/api/docs/[...path]` GET read · PUT save `{content, sha}` · DELETE `{sha}` · PATCH rename `{to}`.

## MCP (Claude, ChatGPT)
- Endpoint `/api/mcp` (Streamable HTTP, `mcp-handler`). Tools: `list_docs`, `read_doc`, `search_docs`, `write_doc`, `move_doc`, `delete_doc`.
  Writes need the `sha` from `read_doc`, so an agent cannot overwrite a human's newer edit. Commits use the signed-in user's name.
- Auth: Folio is its own small OAuth 2.1 server, with no database. Everything is signed with `SESSION_SECRET`:
  - `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`: discovery.
  - `POST /api/oauth/register`: Dynamic Client Registration. The client id is the signed list of redirect URIs.
  - `/oauth/authorize`: sign in (GitHub or password), then Allow. PKCE S256 is required.
  - `POST /api/oauth/token`: code → access token (1 hour) + refresh token (30 days).
- `/connect` page: MCP URL, Claude and ChatGPT steps, and a copyable setup prompt.
- Limits: a code can be reused within its 5 minutes (PKCE still binds it to the client). There is no per-token revoke; revoke by removing the user. No login rate limit.
- Agents use MCP, not git. The app reads GitHub on each request, so changes show on reload.

## v2 (later, not built)
Dashboards pages reading Neon (100-account Instagram tracker, reel metrics), recent docs, full-text search.

## Known limits
- BlockNote's Markdown conversion is lossy for some blocks (colours, nested layouts). Plain Markdown (headings, lists, tables, code, links, checkboxes) round-trips.
- Two people saving the same doc: the second gets a conflict message and must reload.
- Vercel Hobby is for non-commercial use.
