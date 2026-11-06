"use client";

import dynamic from "next/dynamic";

// BlockNote touches the DOM on start, so render it only in the browser.
const DocEditor = dynamic(() => import("./DocEditor"), { ssr: false, loading: () => <p className="p-12 text-stone-400">Loading…</p> });

export default function DocEditorLoader({ path }: { path: string }) {
  return <DocEditor path={path} />;
}
