import { Suspense } from "react";
import DocEditor from "@/components/DocEditorLoader";

async function Doc({ params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.map(decodeURIComponent).join("/");
  return <DocEditor key={path} path={path} />;
}

export default function DocPage({ params }: { params: Promise<{ path: string[] }> }) {
  return (
    <Suspense fallback={<p className="p-12 text-stone-400">Loading…</p>}>
      <Doc params={params} />
    </Suspense>
  );
}
