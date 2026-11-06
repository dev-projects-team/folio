"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cleanPath, titleOf } from "@/lib/paths";

type Node = { name: string; path?: string; dir?: string; readme?: string; children: Map<string, Node> };

const href = (p: string) => `/d/${p.split("/").map(encodeURIComponent).join("/")}`;

function buildTree(paths: string[]): Node {
  const root: Node = { name: "", children: new Map() };
  for (const p of paths) {
    const parts = p.split("/");
    let n = root;
    parts.forEach((part, i) => {
      const leaf = i === parts.length - 1;
      // A README.md inside a folder is that folder's page, not a separate doc row.
      if (leaf && part === "README.md" && i > 0) {
        n.readme = p;
        return;
      }
      const key = leaf ? `doc:${part}` : `dir:${part}`;
      const dir = leaf ? undefined : parts.slice(0, i + 1).join("/");
      if (!n.children.has(key)) n.children.set(key, { name: leaf ? titleOf(part) : part, path: leaf ? p : undefined, dir, children: new Map() });
      n = n.children.get(key)!;
    });
  }
  return root;
}

export const refreshSidebar = () => window.dispatchEvent(new Event("folio:refresh"));

type TreeProps = { node: Node; depth: number; current: string; onNewIn: (dir: string) => void };

function FolderItem({ node, depth, current, onNewIn }: TreeProps) {
  const dir = node.dir!;
  const inside = current.startsWith(`${dir}/`);
  const [open, setOpen] = useState(true);
  // Re-open when navigation lands on a doc inside this folder.
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    if (inside && !open) setOpen(true);
  }
  const row = "rounded py-1 text-sm hover:bg-stone-200/70";
  return (
    <li>
      <div
        className={`group flex items-center text-stone-600 ${current === node.readme ? "bg-stone-200 font-medium" : ""} rounded`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button onClick={() => setOpen(!open)} className={`${row} px-1`} aria-label={open ? "Collapse folder" : "Expand folder"}>
          {open ? "▾" : "▸"}
        </button>
        {node.readme ? (
          <Link href={href(node.readme)} className={`${row} min-w-0 flex-1 truncate px-1`}>
            📁 {node.name}
          </Link>
        ) : (
          <button onClick={() => setOpen(!open)} className={`${row} min-w-0 flex-1 truncate px-1 text-left`}>
            📁 {node.name}
          </button>
        )}
        <button
          onClick={() => onNewIn(dir)}
          title={`New doc in ${dir}`}
          className={`${row} px-2 text-stone-500 opacity-0 group-hover:opacity-100 focus:opacity-100`}
        >
          +
        </button>
      </div>
      {open && <TreeView node={node} depth={depth + 1} current={current} onNewIn={onNewIn} />}
    </li>
  );
}

function TreeView({ node, depth, current, onNewIn }: TreeProps) {
  const items = [...node.children.values()].sort((a, b) => Number(!!a.path) - Number(!!b.path) || a.name.localeCompare(b.name));
  return (
    <ul>
      {items.map((c) =>
        c.path ? (
          <li key={c.path}>
            <Link
              href={href(c.path)}
              className={`block truncate rounded px-2 py-1 text-sm hover:bg-stone-200/70 ${current === c.path ? "bg-stone-200 font-medium" : ""}`}
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              📄 {c.name}
            </Link>
          </li>
        ) : (
          <FolderItem key={`dir:${c.dir}`} node={c} depth={depth} current={current} onNewIn={onNewIn} />
        ),
      )}
    </ul>
  );
}

export default function Sidebar({ login, avatar }: { login: string; avatar: string }) {
  const [paths, setPaths] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState<false | "doc" | "folder">(false);
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

  function startCreate(mode: "doc" | "folder", prefix = "") {
    setCreating(mode);
    setName(prefix);
    setError("");
  }

  async function create() {
    const folder = creating === "folder";
    const raw = name.trim().replace(/\/+$/, "");
    const p = folder ? cleanPath(`${raw}/README.md`) : cleanPath(`${raw.replace(/\.md$/, "")}.md`);
    if (!p) return setError("Use letters, numbers, spaces, - _ . and / only.");
    const r = await fetch("/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: p, content: `# ${folder ? raw.split("/").pop() : titleOf(p)}\n` }),
    });
    if (!r.ok) return setError((await r.json()).error ?? "Could not create.");
    setCreating(false);
    setName("");
    setError("");
    refreshSidebar();
    router.push(href(p));
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
              placeholder={creating === "folder" ? "folder name" : "folder/doc name"}
              className="w-full rounded border border-stone-300 bg-white px-2 py-1 text-sm outline-none"
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>
        ) : (
          <div className="flex gap-1">
            <button onClick={() => startCreate("doc")} className="flex-1 rounded px-2 py-1 text-left text-sm text-stone-600 hover:bg-stone-200/70">
              + New
            </button>
            <button onClick={() => startCreate("folder")} className="rounded px-2 py-1 text-left text-sm text-stone-600 hover:bg-stone-200/70">
              📁 New folder
            </button>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-1 pb-4">
        {paths.length === 0 ? <p className="px-3 text-sm text-stone-400">No docs yet.</p> : <TreeView node={shown} depth={0} current={current} onNewIn={(dir) => startCreate("doc", `${dir}/`)} />}
      </nav>
      <Link
        href="/connect"
        className={`mx-1 mb-2 rounded px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-200/70 ${pathname === "/connect" ? "bg-stone-200 font-medium" : ""}`}
      >
        🔌 Connect AI
      </Link>
    </aside>
  );
}
