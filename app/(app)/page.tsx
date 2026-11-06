export default function Home() {
  return (
    <div className="mx-auto max-w-2xl px-12 py-24 text-stone-500">
      <h1 className="mb-3 text-3xl font-semibold text-stone-800">Folio</h1>
      <p>Pick a doc on the left, or press <b>+ New</b> to create one.</p>
      <p className="mt-2 text-sm">Use a slash for folders, for example <code>reels/day-3-plan</code>.</p>
    </div>
  );
}
