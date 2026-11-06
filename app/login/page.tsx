import { Suspense } from "react";
const ERRORS: Record<string, string> = {
  "not-allowed": "This GitHub account is not on the team list.",
  state: "Sign-in expired. Try again.",
  token: "GitHub sign-in failed. Try again.",
};

async function ErrorLine({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return error ? <p className="mb-4 text-sm text-red-600">{ERRORS[error] ?? "Sign-in failed."}</p> : null;
}

export default function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="flex h-full items-center justify-center bg-[#f7f6f3]">
      <div className="w-80 rounded-lg border border-stone-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold">Folio</h1>
        <p className="mb-6 text-sm text-stone-500">Team docs</p>
        <Suspense>
          <ErrorLine searchParams={searchParams} />
        </Suspense>
        <a href="/api/auth/login" className="block rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
          Sign in with GitHub
        </a>
      </div>
    </main>
  );
}
