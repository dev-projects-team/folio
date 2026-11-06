import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { clientFor } from "@/lib/oauth";

type Params = Promise<Record<string, string | undefined>>;
const Box = ({ children }: { children: React.ReactNode }) => (
  <main className="flex h-full items-center justify-center bg-[#f7f6f3]">
    <div className="w-96 rounded-lg border border-stone-200 bg-white p-8 shadow-sm">{children}</div>
  </main>
);

// MCP sign-in step: the user is sent here by Claude or ChatGPT, signs in, then allows access.
async function Consent({ searchParams }: { searchParams: Params }) {
  const p = await searchParams;
  const client = await clientFor(p.client_id ?? "", p.redirect_uri ?? "");
  if (!client || p.response_type !== "code" || !p.code_challenge || p.code_challenge_method !== "S256") {
    return <p className="text-sm text-red-600">This connect link is not valid. Start again from your AI app.</p>;
  }
  const user = await currentUser();
  if (!user) {
    const here = `/oauth/authorize?${new URLSearchParams(p as Record<string, string>)}`;
    redirect(`/login?next=${encodeURIComponent(here)}`);
  }
  const hidden = ["client_id", "redirect_uri", "state", "code_challenge"] as const;
  return (
    <form action="/api/oauth/authorize" method="post">
      {hidden.map((k) => <input key={k} type="hidden" name={k} value={p[k] ?? ""} />)}
      <h1 className="mb-2 text-lg font-semibold">Connect {client.n} to Folio</h1>
      <p className="mb-6 text-sm text-stone-600">
        <b>{client.n}</b> will read, create, edit, rename and delete team docs as <b>{user.login}</b>. Every change is a git commit with your name.
      </p>
      <div className="flex gap-2">
        <button name="decision" value="allow" className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">Allow</button>
        <button name="decision" value="deny" className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm hover:bg-stone-100">Cancel</button>
      </div>
    </form>
  );
}

export default function Authorize({ searchParams }: { searchParams: Params }) {
  return (
    <Box>
      <Suspense fallback={<p className="text-sm text-stone-400">Loading…</p>}>
        <Consent searchParams={searchParams} />
      </Suspense>
    </Box>
  );
}
