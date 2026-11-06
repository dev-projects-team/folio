# Folio — team docs, v1 spec

A private docs app for 5 people. It looks like Notion: a sidebar of folders and docs, and a block editor.
Docs are Markdown files in a git repo, so every teammate's Claude can read and edit them directly.

## Goals (v1)
1. See all docs in a sidebar tree (folders + docs), filter by title.
2. Create, edit, rename and delete docs. Create folders.
3. Edit in a Notion-style block editor (BlockNote). Save with the button or Cmd+S.
4. Every save is a git commit in the content repo, with the editor's GitHub name in the message.
5. Only the 5 allowed GitHub users can sign in.

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
- Folders: GitHub has no empty folders, so "new folder" creates `folder/README.md`.

## Auth
- GitHub OAuth app (owned by the org). Routes `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`.
- Allowlist: `ALLOWED_GITHUB_USERS` (comma-separated, case-insensitive).
- Session: HMAC-SHA256 signed cookie (`SESSION_SECRET`), `httpOnly`, `secure`, `sameSite=lax`, 30 days. Payload: login, avatar, expiry.
- `proxy.ts` blocks every page and API route without a valid session, except `/login` and `/api/auth/*`.
- `AUTH_DISABLED=1` only works when `NODE_ENV !== 'production'` (local dev).

## Env
`CONTENT_DIR` | `CONTENT_REPO`, `GITHUB_TOKEN` · `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `ALLOWED_GITHUB_USERS`, `APP_URL` · `AUTH_DISABLED` (dev only). Secrets only in `.env.local` / Vercel env, never in git.

## Routes
- `/` → sidebar + welcome (recent list not in v1).
- `/d/[...path]` → doc editor.
- `/api/docs` GET tree · POST create `{path, content}`.
- `/api/docs/[...path]` GET read · PUT save `{content, sha}` · DELETE `{sha}` · PATCH rename `{to}`.

## How Claude edits
Clone `dev-projects-team/folio-content`, edit `.md` files, commit, push. The app reads GitHub on each request (no cache in v1), so changes show on reload.

## v2 (later, not built)
Dashboards pages reading Neon (100-account Instagram tracker, reel metrics), recent docs, full-text search.

## Known limits
- BlockNote's Markdown conversion is lossy for some blocks (colours, nested layouts). Plain Markdown (headings, lists, tables, code, links, checkboxes) round-trips.
- Two people saving the same doc: the second gets a conflict message and must reload.
- Vercel Hobby is for non-commercial use.
