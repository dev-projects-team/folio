"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cleanPath } from "@/lib/paths";
import { refreshSidebar } from "./Sidebar";

const url = (p: string) => `/api/docs/${p.split("/").map(encodeURIComponent).join("/")}`;
type Status = "loading" | "saved" | "unsaved" | "saving" | "conflict" | "error" | "missing";

export default function DocEditor({ path }: { path: string }) {
  const editor = useCreateBlockNote();
  const router = useRouter();
  const sha = useRef<string>("");
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [name, setName] = useState(path.replace(/\.md$/, ""));

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await fetch(url(path), { cache: "no-store" });
      if (!live) return;
      if (r.status === 404) return setStatus("missing");
      if (!r.ok) return setStatus("error");
      const doc = await r.json();
      sha.current = doc.sha;
      editor.replaceBlocks(editor.document, editor.tryParseMarkdownToBlocks(doc.content));
      setStatus("saved");
    })();
    return () => {
      live = false;
    };
  }, [path, editor]);

  const save = useCallback(async () => {
    if (status === "loading" || status === "saving" || status === "missing") return;
    setStatus("saving");
    const content = editor.blocksToMarkdownLossy(editor.document);
    const r = await fetch(url(path), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, sha: sha.current }),
    });
    const body = await r.json();
    if (r.status === 409) {
      setMessage(body.error);
      return setStatus("conflict");
    }
    if (!r.ok) {
      setMessage(body.error ?? "Save failed.");
      return setStatus("error");
    }
    sha.current = body.sha;
    setStatus("saved");
  }, [editor, path, status]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (status === "unsaved") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [save, status]);

  async function rename() {
    const to = cleanPath(`${name.trim().replace(/\.md$/, "")}.md`);
    if (!to || to === path) return setName(path.replace(/\.md$/, ""));
    if (status === "unsaved") await save();
    const r = await fetch(url(path), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to }) });
    if (!r.ok) {
      setMessage((await r.json()).error ?? "Rename failed.");
      setName(path.replace(/\.md$/, ""));
      return setStatus("error");
    }
    refreshSidebar();
    router.replace(`/d/${to.split("/").map(encodeURIComponent).join("/")}`);
  }

  async function remove() {
    if (!confirm(`Delete "${path}"? It stays in the git history.`)) return;
    const r = await fetch(url(path), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sha: sha.current }) });
    if (!r.ok) {
      setMessage((await r.json()).error ?? "Delete failed.");
      return setStatus("error");
    }
    refreshSidebar();
    router.push("/");
  }

  if (status === "missing") return <p className="p-12 text-stone-500">This doc does not exist. It may have been renamed or deleted.</p>;

  const label: Record<Status, string> = {
    loading: "Loading…", saved: "Saved", unsaved: "Unsaved changes", saving: "Saving…", conflict: message, error: message, missing: "",
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="min-w-0 flex-1 rounded px-1 text-sm text-stone-500 outline-none hover:bg-stone-100 focus:bg-stone-100"
          title="Rename (use / for folders)"
        />
        <span className={`text-xs ${status === "conflict" || status === "error" ? "text-red-600" : "text-stone-400"}`}>{label[status]}</span>
        {status === "conflict" ? (
          <button onClick={() => location.reload()} className="rounded bg-stone-900 px-3 py-1 text-xs text-white">Reload</button>
        ) : (
          <button onClick={save} disabled={status !== "unsaved"} className="rounded bg-stone-900 px-3 py-1 text-xs text-white disabled:opacity-30">
            Save
          </button>
        )}
        <button onClick={remove} className="text-xs text-stone-400 hover:text-red-600">Delete</button>
      </div>
      <BlockNoteView
        editor={editor}
        theme="light"
        editable={status !== "loading"}
        onChange={() => setStatus((s) => (s === "saved" ? "unsaved" : s))}
      />
    </div>
  );
}
