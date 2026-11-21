"use client";

import { Button } from "@/components/ui/button";

/** Last-resort boundary: an unexpected render error shows this instead of a blank page. */
export default function ShellError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="m-8 max-w-lg space-y-3 rounded-block border-[1.5px] border-red bg-red-tint p-5">
      <p className="text-[15px] font-semibold text-red-text">This view hit an unexpected error</p>
      <p className="text-[14px] text-text-2">{error.message || "Something went wrong."} Try again; if it keeps happening, reload the page.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
