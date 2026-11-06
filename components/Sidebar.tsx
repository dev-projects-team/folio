"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cleanPath, titleOf } from "@/lib/paths";

type Node = { name: string; path?: string; dir?: string; readme?: string; children: Map<string, Node> };
type Creating = { mode: "doc" | "folder"; dir: string } | null;

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

// ---- Icons (16px, stroke) ----
const ICONS = {
  chevron: <path d="m9 6 6 6-6 6" />,
  folder: <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z" />,
  file: <><path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z" /><path d="M14 3v5h5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  folderPlus: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z" /><path d="M12 10.5v5M9.5 13h5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>,
  x: <path d="M17 7 7 17M7 7l10 10" />,
  plug: <path d="M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4" />,
  logout: <path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3M15 16l4-4-4-4M19 12H9" />,
};
function Icon({ name, className = "" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden
      className={`h-4 w-4 shrink-0 ${className}`}>
      {ICONS[name]}
    </svg>
  );
}

const ROW = "group flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[13.5px] transition-colors duration-150";
const IDLE = "text-stone-600 hover:bg-stone-200/60 hover:text-stone-900";
const ACTIVE = "bg-stone-200/80 font-medium text-stone-900";
const ICON_BTN = "grid h-6 w-6 place-items-center rounded text-stone-400 transition-colors hover:bg-stone-300/50 hover:text-stone-700";

// ---- Inline "new doc / new folder" row. Enter creates; Esc, the X, or leaving it empty cancels. ----
function CreateRow({ creating, onCancel, onCreated }: { creating: NonNullable<Creating>; onCancel: () => void; onCreated: (p: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const folder = creating.mode === "folder";

  async function create() {
    const raw = name.trim().replace(/^\/+|\/+$/g, "").replace(/\.md$/, "");
    if (!raw) return onCancel();
    const full = creating.dir ? `${creating.dir}/${raw}` : raw;
    const p = cleanPath(folder ? `${full}/README.md` : `${full}.md`);
    if (!p) return setError("Use letters, numbers, spaces, - _ . and / only.");
    setBusy(true);
    const r = await fetch("/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: p, content: `# ${raw.split("/").pop()}\n` }),
    });
    setBusy(false);
    if (!r.ok) return setError((await r.json()).error ?? "Could not create.");
    onCreated(p);
  }

  return (
    <li className="py-0.5">
      <div className="flex h-7 items-center gap-1.5 rounded-md bg-white px-1.5 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.06)]">
        <Icon name={folder ? "folder" : "file"} className="text-stone-400" />
        <input
          autoFocus
          value={name}
          disabled={busy}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
            if (e.key === "Escape") onCancel();
          }}
          onBlur={() => !name.trim() && onCancel()}
          placeholder={folder ? "Folder name" : "Doc name"}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-stone-900 outline-none placeholder:text-stone-400"
        />
        {/* onMouseDown keeps the input focused, so blur does not fire first. */}
        <button onMouseDown={(e) => e.preventDefault()} onClick={onCancel} className={ICON_BTN} title="Cancel (Esc)" aria-label="Cancel">
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className={`px-1.5 pt-1 text-[11px] ${error ? "text-red-600" : "text-stone-400"}`}>
        {error || `Enter to create${creating.dir ? ` in ${creating.dir}` : ""} · Esc to cancel`}
      </p>
    </li>
  );
}

type TreeProps = {
  node: Node;
  current: string;
  creating: Creating;
  onNew: (c: NonNullable<Creating>) => void;
  createRow: (dir: string) => React.ReactNode;
};

function FolderItem({ node, current, creating, onNew, createRow }: TreeProps) {
  const dir = node.dir!;
  const [open, setOpen] = useState(true);
  // Re-open when navigation lands on a doc inside this folder.
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    if (current.startsWith(`${dir}/`) && !open) setOpen(true);
  }
  const isOpen = open || creating?.dir === dir;
  const hasKids = node.children.size > 0 || creating?.dir === dir;
  const active = current === node.readme;
  const label = (
    <>
      <Icon name="folder" className={active ? "text-stone-600" : "text-stone-400"} />
      <span className="truncate">{node.name}</span>
    </>
  );
  return (
    <li>
      <div className={`${ROW} ${active ? ACTIVE : IDLE} pr-1`}>
        {hasKids ? (
          <button onClick={() => setOpen(!isOpen)} className="-ml-0.5 grid h-5 w-5 place-items-center rounded text-stone-400 hover:bg-stone-300/50"
            aria-label={isOpen ? "Collapse folder" : "Expand folder"} aria-expanded={isOpen}>
            <Icon name="chevron" className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="-ml-0.5 w-5" />
        )}
        {node.readme ? (
          <Link href={href(node.readme)} className="flex min-w-0 flex-1 items-center gap-1.5">{label}</Link>
        ) : (
          <button onClick={() => setOpen(!isOpen)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">{label}</button>
        )}
        <span className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button onClick={() => onNew({ mode: "doc", dir })} className={ICON_BTN} title={`New doc in ${dir}`} aria-label={`New doc in ${dir}`}>
            <Icon name="plus" className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onNew({ mode: "folder", dir })} className={ICON_BTN} title={`New folder in ${dir}`} aria-label={`New folder in ${dir}`}>
            <Icon name="folderPlus" className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
      {/* Grid-rows trick: animates height between 0 and auto. inert keeps hidden rows out of Tab order. */}
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`} inert={!isOpen}>
        <div className="overflow-hidden">
          <div className="ml-[15px] border-l border-stone-200 pl-1.5">
            <TreeView node={node} current={current} creating={creating} onNew={onNew} createRow={createRow} />
          </div>
        </div>
      </div>
    </li>
  );
}

function TreeView(props: TreeProps) {
  const { node, current } = props;
  const items = [...node.children.values()].sort((a, b) => Number(!!a.path) - Number(!!b.path) || a.name.localeCompare(b.name));
  return (
    <ul className="space-y-px">
      {props.createRow(node.dir ?? "")}
      {items.map((c) =>
        c.path ? (
          <li key={c.path}>
            <Link href={href(c.path)} className={`${ROW} ${current === c.path ? ACTIVE : IDLE} pl-[26px]`}>
              <Icon name="file" className={current === c.path ? "text-stone-600" : "text-stone-400"} />
              <span className="truncate">{c.name}</span>
            </Link>
          </li>
        ) : (
          <FolderItem key={`dir:${c.dir}`} {...props} node={c} />
        ),
      )}
    </ul>
  );
}

export default function Sidebar({ login, avatar }: { login: string; avatar: string }) {
  const [paths, setPaths] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState<Creating>(null);
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

  const createRow = (dir: string) =>
    creating?.dir === dir ? (
      <CreateRow
        key={`${creating.mode}:${dir}`}
        creating={creating}
        onCancel={() => setCreating(null)}
        onCreated={(p) => {
          setCreating(null);
          refreshSidebar();
          router.push(href(p));
        }}
      />
    ) : null;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-stone-200/80 bg-[#f7f7f5]">
      <div className="px-2 pt-3">
        <Link href="/" className="flex h-8 items-center gap-2 rounded-md px-1.5 transition-colors hover:bg-stone-200/60">
          <span className="grid h-5 w-5 place-items-center rounded bg-stone-900 text-[11px] font-semibold text-white">F</span>
          <span className="text-sm font-semibold text-stone-900">Folio</span>
        </Link>
        <label className="mt-2 flex h-8 items-center gap-2 rounded-md bg-stone-200/50 px-2 text-stone-400 transition-colors focus-within:bg-white focus-within:shadow-[0_0_0_1px_rgb(0_0_0/0.1)]">
          <Icon name="search" className="h-3.5 w-3.5" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setFilter("")}
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-stone-900 outline-none placeholder:text-stone-400"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between px-3.5 pb-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400">Docs</span>
        <span className="flex">
          <button onClick={() => setCreating({ mode: "doc", dir: "" })} className={ICON_BTN} title="New doc" aria-label="New doc">
            <Icon name="plus" className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setCreating({ mode: "folder", dir: "" })} className={ICON_BTN} title="New folder" aria-label="New folder">
            <Icon name="folderPlus" className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {paths.length === 0 && !creating ? (
          <p className="px-1.5 py-1 text-[13px] text-stone-400">No docs yet. Press + to start.</p>
        ) : (
          <TreeView node={shown} current={current} creating={creating} onNew={setCreating} createRow={createRow} />
        )}
      </nav>

      <div className="space-y-px border-t border-stone-200/80 p-2">
        <Link href="/connect" className={`${ROW} ${pathname === "/connect" ? ACTIVE : IDLE}`}>
          <Icon name="plug" className="text-stone-400" />
          Connect AI
        </Link>
        <div className={`${ROW} text-stone-600`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- small GitHub avatar */}
          {avatar ? <img src={avatar} alt="" className="h-5 w-5 rounded-full" /> : (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-stone-300 text-[10px] font-semibold uppercase text-stone-700">{login[0]}</span>
          )}
          <span className="min-w-0 flex-1 truncate">{login}</span>
          <form action="/api/auth/logout" method="post">
            <button className={ICON_BTN} title="Sign out" aria-label="Sign out">
              <Icon name="logout" className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
