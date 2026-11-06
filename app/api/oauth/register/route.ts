import { json, okRedirect, preflight, registerClient } from "@/lib/oauth";

// Dynamic Client Registration (RFC 7591). Claude and ChatGPT call this once per connector.
// Nothing is stored: the client id is the signed list of its redirect URIs.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const uris: unknown[] = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];
  if (!uris.length || uris.length > 10 || !uris.every(okRedirect)) {
    return json({ error: "invalid_redirect_uri", error_description: "redirect_uris must be https (or http://localhost)" }, 400);
  }
  const name = typeof body.client_name === "string" ? body.client_name : "MCP client";
  return json(
    {
      client_id: await registerClient(uris as string[], name),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    201,
  );
}
export const OPTIONS = preflight;
