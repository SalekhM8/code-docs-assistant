import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-dvh items-center justify-center p-8">
      <div className="max-w-md space-y-3 rounded-card bg-surface p-8 shadow-card">
        <h1 className="font-serif text-[28px] font-light tracking-[-0.03em]">Page not found<span className="text-mark">.</span></h1>
        <p className="text-[14px] text-text-2">This page does not exist. It may have been a repo or conversation that was deleted.</p>
        <Link href="/" className="inline-block rounded-full bg-text px-5 py-2.5 text-[14px] font-semibold text-surface">Back to your repos</Link>
      </div>
    </main>
  );
}
