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

## Edit docs with Claude
Clone `folio-content`, edit the `.md` files, commit and push. The app shows the change on reload.

## Deploy (not done yet)
Vercel project on this repo. Set the production env vars listed in `.env.example`.
Create a GitHub OAuth app in `dev-projects-team` with callback `<APP_URL>/api/auth/callback`.
