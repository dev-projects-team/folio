# Folio

> **Why "Folio"?** A *folio* is a sheet or page of a book or document (Latin *folium*, "leaf").
> The same root gives *portfolio*: a set of pages you carry. This app is our team's set of pages.

Team docs for 5 people. Notion-style editor, docs stored as Markdown in `dev-projects-team/folio-content`.
Read `SPEC.md` first.

## Run locally
```bash
pnpm install
git clone git@github.com:dev-projects-team/folio-content.git ../folio-content
cp .env.example .env.local   # local mode: CONTENT_DIR + AUTH_DISABLED=1
pnpm dev                     # http://localhost:3000
```

## Connect Claude or ChatGPT (MCP)
Open **Connect AI** in the sidebar (`/connect`). It shows the MCP URL (`<APP_URL>/api/mcp`), the steps for
Claude and ChatGPT, and a setup prompt to paste into an agent. Sign-in is OAuth: the user signs in to Folio
(GitHub or password) and presses Allow. Do not edit the content repo with git directly.

## Password users
`pnpm hash-password <username> <password>` prints one entry. Put entries in `PASSWORD_USERS`, joined by commas.
To remove anyone (GitHub or password), delete them from the env var and redeploy. Their sessions and MCP tokens stop working.

## Deploy (not done yet)
Vercel project on this repo. Set the production env vars listed in `.env.example`.
Create a GitHub OAuth app in `dev-projects-team` with callback `<APP_URL>/api/auth/callback`.
