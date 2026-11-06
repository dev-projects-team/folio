"use client";

import { useEffect, useState } from "react";

function Copy({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}
      className="shrink-0 rounded bg-stone-900 px-3 py-1 text-xs text-white hover:bg-stone-700"
    >
      {done ? "Copied" : label}
    </button>
  );
}

function Code({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-stone-200 bg-stone-50 px-2 py-1.5">
      <code className="min-w-0 flex-1 truncate text-xs">{value}</code>
      <Copy value={value} />
    </div>
  );
}

// "Connect with Claude / ChatGPT": the MCP URL, the steps, and a prompt to paste into an agent.
export default function Connect() {
  const [origin, setOrigin] = useState("");
  // The page is client-only, so read the site URL after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOrigin(location.origin), []);
  const url = `${origin}/api/mcp`;
  const cli = `claude mcp add --transport http folio ${url}`;
  const prompt = `Connect to our team docs, Folio, as a remote MCP server.
- URL: ${url}
- Transport: Streamable HTTP. Auth: OAuth (the server handles sign-in; no API key).
- In Claude Code run: ${cli}
  then run /mcp, pick "folio" and choose Authenticate.
- In Claude or ChatGPT apps, add it as a custom connector with this URL.
I will sign in with my Folio account in the browser and press Allow.
After that, call list_docs to check it works.`;

  if (!origin) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-10 text-sm text-stone-700">
      <div>
        <h1 className="mb-2 text-2xl font-semibold text-stone-900">Connect your AI</h1>
        <p className="text-stone-500">
          Let Claude or ChatGPT read and edit Folio docs. You sign in with your Folio account, so every change is saved in your name.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-stone-900">Folio MCP URL</h2>
        <Code value={url} />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-stone-900">Let your agent set it up</h2>
          <Copy value={prompt} label="Copy setup prompt" />
        </div>
        <p className="text-stone-500">Paste this prompt into your agent. It adds Folio, then you sign in and press Allow.</p>
      </section>

      <section className="space-y-3 rounded-lg border border-stone-200 p-5">
        <h2 className="text-base font-semibold text-stone-900">Connect with Claude</h2>
        <p className="font-medium">Claude app (web or desktop)</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open Settings → Connectors → Add custom connector.</li>
          <li>Name: <b>Folio</b>. URL: the Folio MCP URL above.</li>
          <li>Press Connect. Sign in to Folio, then press Allow.</li>
        </ol>
        <p className="pt-2 font-medium">Claude Code</p>
        <Code value={cli} />
        <p>Then run <code>/mcp</code>, pick <b>folio</b>, and choose Authenticate.</p>
      </section>

      <section className="space-y-3 rounded-lg border border-stone-200 p-5">
        <h2 className="text-base font-semibold text-stone-900">Connect with ChatGPT</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open Settings → Apps &amp; Connectors → Advanced, and turn on Developer mode.</li>
          <li>Create a new connector. Name: <b>Folio</b>. URL: the Folio MCP URL above. Authentication: OAuth.</li>
          <li>Sign in to Folio, then press Allow.</li>
          <li>In a chat, turn on Folio from the tools menu.</li>
        </ol>
        <p className="text-xs text-stone-400">ChatGPT moves these menus often. If you cannot find them, search its settings for &quot;Developer mode&quot;.</p>
      </section>
    </div>
  );
}
