import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { cleanPath } from "@/lib/paths";
import { Conflict, NotFound, store } from "@/lib/store";

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(ctx: Ctx, fn: (p: string, login: string) => Promise<NextResponse>) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const p = cleanPath((await ctx.params).path.map(decodeURIComponent).join("/"));
  if (!p) return NextResponse.json({ error: "bad path" }, { status: 400 });
  try {
    return await fn(p, user.login);
  } catch (e) {
    if (e instanceof NotFound) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (e instanceof Conflict) return NextResponse.json({ error: "Changed by someone else. Reload." }, { status: 409 });
    throw e;
  }
}

export const GET = (_: NextRequest, ctx: Ctx) => handle(ctx, async (p) => NextResponse.json(await store().read(p)));

export const PUT = (req: NextRequest, ctx: Ctx) =>
  handle(ctx, async (p, login) => {
    const { content, sha } = await req.json();
    if (typeof sha !== "string") return NextResponse.json({ error: "sha required" }, { status: 400 });
    return NextResponse.json({ sha: await store().write(p, String(content ?? ""), sha, login) });
  });

export const DELETE = (req: NextRequest, ctx: Ctx) =>
  handle(ctx, async (p, login) => {
    const { sha } = await req.json();
    await store().remove(p, String(sha), login);
    return NextResponse.json({ ok: true });
  });

export const PATCH = (req: NextRequest, ctx: Ctx) =>
  handle(ctx, async (p, login) => {
    const to = cleanPath(String((await req.json()).to ?? ""));
    if (!to) return NextResponse.json({ error: "bad new name" }, { status: 400 });
    await store().rename(p, to, login);
    return NextResponse.json({ path: to });
  });
