"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cleanPath, titleOf } from "@/lib/paths";

type Node = { name: string; path?: string; children: Map<string, Node> };

function buildTree(paths: string[]): Node {
  const root: Node = { name: "", children: new Map() };
  for (const p of paths) {
    const parts = p.split("/");
    let n = root;
    parts.forEach((part, i) => {
      const leaf = i === parts.length - 1;
      const key = leaf ? `doc:${part}` : `dir:${part}`;
      if (!n.children.has(key)) n.children.set(key, { name: leaf ? titleOf(part) : part, path: leaf ? p : undefined, children: new Map() });
      n = n.children.get(key)!;
    });
  }
  return root;
}

export const refreshSidebar = () => window.dispatchEvent(new Event("folio:refresh"));

function TreeView({ node, depth, current }: { node: Node; depth: number; current: string }) {
  const [open, setOpen] = useState(true);
  const items = [...node.children.values()].sort((a, b) => Number(!!a.path) - Number(!!b.path) || a.name.localeCompare(b.name));
  return (
    <ul>
      {items.map((c) =>
        c.path ? (
          <li key={c.path}>
            <Link
              href={`/d/${c.path.split("/").map(encodeURIComponent).join("/")}`}
              className={`block truncate rounded px-2 py-1 text-sm hover:bg-stone-200/70 ${current === c.path ? "bg-stone-200 font-medium" : ""}`}
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              📄 {c.name}
            </Link>
          </li>
        ) : (
          <li key={`dir:${c.name}`}>
            <button
              onClick={() => setOpen(!open)}
              className="block w-full truncate rounded px-2 py-1 text-left text-sm text-stone-600 hover:bg-stone-200/70"
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              {open ? "▾" : "▸"} 📁 {c.name}
            </button>
            {open && <TreeView node={c} depth={depth + 1} current={current} />}
          </li>
        ),
      )}
    </ul>
  );
}

export default function Sidebar({ login, avatar }: { login: string; avatar: string }) {
  const [paths, setPaths] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const current = pathname.startsWith("/d/") ? pathname.slice(3).split("/").map(decodeURIComponent).join("/") : "";

  useEffect(() => {
    const load = () =>
      fetch("/api/docs", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j && setPaths(j.paths));
    load();
    window.addEventListener("folio:refresh", load);
    return () => window.removeEventListener("folio:refresh", load);
  }, []);

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return buildTree(f ? paths.filter((p) => p.toLowerCase().includes(f)) : paths);
  }, [paths, filter]);

  async function create() {
    const raw = name.trim().replace(/\.md$/, "");
    const p = cleanPath(`${raw}.md`);
    if (!p) return setError("Use letters, numbers, spaces, - _ . and / only.");
    const r = await fetch("/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: p, content: `# ${titleOf(p)}\n` }),
    });
    if (!r.ok) return setError((await r.json()).error ?? "Could not create.");
    setCreating(false);
    setName("");
    setError("");
    refreshSidebar();
    router.push(`/d/${p.split("/").map(encodeURIComponent).join("/")}`);
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-stone-200 bg-[#f7f6f3]">
      <div className="flex items-center gap-2 px-3 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- small GitHub avatar */}
        {avatar ? <img src={avatar} alt="" className="h-5 w-5 rounded" /> : <span className="h-5 w-5 rounded bg-stone-300" />}
        <Link href="/" className="flex-1 truncate text-sm font-semibold">Folio</Link>
        <form action="/api/auth/logout" method="post">
          <button className="text-xs text-stone-500 hover:text-stone-800" title={`Signed in as ${login}`}>Sign out</button>
        </form>
      </div>
      <div className="space-y-2 px-3 pb-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search titles"
          className="w-full rounded border border-stone-200 bg-white px-2 py-1 text-sm outline-none focus:border-stone-400"
        />
        {creating ? (
          <div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="folder/doc name"
              className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm outline-none"
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>
        ) : (
          <button onClick={() => setCreating(true)} className="w-full rounded px-2 py-1 text-left text-sm text-stone-600 hover:bg-stone-200/70">
            + New
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-1 pb-4">
        {paths.length === 0 ? <p className="px-3 text-sm text-stone-400">No docs yet.</p> : <TreeView node={shown} depth={0} current={current} />}
      </nav>
    </aside>
  );
}
