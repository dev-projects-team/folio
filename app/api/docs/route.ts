import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { cleanPath } from "@/lib/paths";
import { Conflict, store } from "@/lib/store";

export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: "sign in" }, { status: 401 });
  return NextResponse.json({ paths: await store().list() });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const { path, content } = await req.json();
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
