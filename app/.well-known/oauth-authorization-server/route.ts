import { issuer, json, preflight } from "@/lib/oauth";

// RFC 8414 metadata. MCP clients read this to find the sign-in and token URLs.
export function GET(req: Request) {
  const iss = issuer(req);
  return json({
    issuer: iss,
    authorization_endpoint: `${iss}/oauth/authorize`,
    token_endpoint: `${iss}/api/oauth/token`,
    registration_endpoint: `${iss}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["docs"],
  });
}
export const OPTIONS = preflight;
