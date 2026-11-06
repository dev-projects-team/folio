import { Suspense } from "react";
import { safeNext } from "@/lib/session";

type Params = Promise<{ error?: string; next?: string }>;

const ERRORS: Record<string, string> = {
  "not-allowed": "This GitHub account is not on the team list.",
  state: "Sign-in expired. Try again.",
  token: "GitHub sign-in failed. Try again.",
  password: "Wrong username or password.",
};

// Reads searchParams, so it streams behind Suspense (Next 16 cache components).
async function Forms({ searchParams }: { searchParams: Params }) {
  const { error, next } = await searchParams;
  const to = safeNext(next);
  return (
    <>
      {error && <p className="mb-4 text-sm text-red-600">{ERRORS[error] ?? "Sign-in failed."}</p>}
      <a
        href={`/api/auth/login?next=${encodeURIComponent(to)}`}
        className="block rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
      >
        Sign in with GitHub
      </a>
      <p className="my-4 text-xs text-stone-400">or</p>
      <form action="/api/auth/password" method="post" className="space-y-2 text-left">
        <input type="hidden" name="next" value={to} />
        <input name="username" required autoComplete="username" placeholder="Username"
          className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-stone-500" />
        <input name="password" type="password" required autoComplete="current-password" placeholder="Password"
          className="w-full rounded border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-stone-500" />
        <button className="w-full rounded-md border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100">
          Sign in with password
        </button>
      </form>
    </>
  );
}

export default function Login({ searchParams }: { searchParams: Params }) {
  return (
    <main className="flex h-full items-center justify-center bg-[#f7f6f3]">
      <div className="w-80 rounded-lg border border-stone-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold">Folio</h1>
        <p className="mb-6 text-sm text-stone-500">Team docs</p>
        <Suspense>
          <Forms searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
