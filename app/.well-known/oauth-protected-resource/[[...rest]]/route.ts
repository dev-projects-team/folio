import { issuer, json, preflight } from "@/lib/oauth";

// RFC 9728 metadata for /api/mcp. Also answers the path form
// /.well-known/oauth-protected-resource/api/mcp that some clients try first.
export function GET(req: Request) {
  const iss = issuer(req);
  return json({ resource: `${iss}/api/mcp`, authorization_servers: [iss], scopes_supported: ["docs"], bearer_methods_supported: ["header"] });
}
export const OPTIONS = preflight;
