import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { cleanPath } from "@/lib/paths";
import { Conflict, store } from "@/lib/store";

export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: "sign in" }, { status: 401 });
  return NextResponse.json(await store().snapshot());
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const { path, content, folder } = await req.json();
  // { folder: "a/b" } makes an empty folder. The name follows the same rules as a doc path.
  if (folder !== undefined) {
    const dir = cleanPath(`${String(folder).trim().replace(/^\/+|\/+$/g, "")}/x.md`)?.slice(0, -5);
    if (!dir) return NextResponse.json({ error: "bad folder name" }, { status: 400 });
    try {
      await store().mkdir(dir, user.login);
      return NextResponse.json({ folder: dir }, { status: 201 });
    } catch (e) {
      if (e instanceof Conflict) return NextResponse.json({ error: "this folder exists" }, { status: 409 });
      throw e;
    }
  }
  const p = cleanPath(String(path ?? ""));
  if (!p) return NextResponse.json({ error: "bad path" }, { status: 400 });
  try {
    const sha = await store().write(p, String(content ?? ""), null, user.login);
    return NextResponse.json({ path: p, sha }, { status: 201 });
  } catch (e) {
    if (e instanceof Conflict) return NextResponse.json({ error: "a doc with this name exists" }, { status: 409 });
    throw e;
  }
}
