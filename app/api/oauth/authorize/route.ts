import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { cidOf, clientFor, issueCode } from "@/lib/oauth";

// The consent form posts here. SameSite=lax cookies mean another site cannot post this for the user.
export async function POST(req: NextRequest) {
  const f = await req.formData();
  const get = (k: string) => String(f.get(k) ?? "");
  const clientId = get("client_id"), redirectUri = get("redirect_uri"), state = get("state"), challenge = get("code_challenge");
  if (!(await clientFor(clientId, redirectUri)) || !challenge) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const back = new URL(redirectUri);
  if (state) back.searchParams.set("state", state);
  const user = await currentUser();
  if (!user || get("decision") !== "allow") {
    back.searchParams.set("error", "access_denied");
    return NextResponse.redirect(back, 303);
  }
  back.searchParams.set("code", await issueCode({ login: user.login, via: user.via, cid: cidOf(clientId) }, redirectUri, challenge));
  return NextResponse.redirect(back, 303);
}
