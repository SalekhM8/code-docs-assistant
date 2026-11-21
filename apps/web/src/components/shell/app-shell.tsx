"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { usePanels } from "@/components/panels";
import { TraceDrawer } from "@/components/trace-drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ApiStatus } from "./api-status";
import { Places } from "./places";
import { StageHost } from "./stage-host";
import { TopBar } from "./top-bar";

// Loaded on the first citation click, with the syntax highlighter inside it.
const CodePanel = dynamic(() => import("@/components/code/code-panel"), {
  ssr: false,
  loading: () => <p className="p-6 text-[13px] text-text-dim">Opening the code viewer…</p>,
});

/**
 * The White House layout: the 3D floor fills the window, and everything else floats over it
 * as cream cards. Places on the left, where-you-are and counts top right, the chat on the
 * right like the Chief of Staff panel, and the code viewer over the floor between them.
 * Below 1280px the floor is dropped and the chat takes the window.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { code, closeCode } = usePanels();
  const wide = useMediaQuery("(min-width: 1280px)");
  const { repoId, conversationId } = useParams<{ repoId?: string; conversationId?: string }>();
  // The narrow-screen Places sheet is open for the path it was opened on, so navigating closes it.
  const pathname = usePathname();
  const [placesOpenOn, setPlacesOpenOn] = useState<string | null>(null);
  const placesOpen = placesOpenOn === pathname;

  return (
    <div className="relative h-dvh overflow-hidden bg-bg">
      {wide && <StageHost repoId={repoId} conversationId={conversationId} />}

      <div className="pointer-events-none absolute left-0 top-0 z-30 flex w-full flex-col gap-3 p-2 sm:p-3 xl:bottom-0 xl:w-[320px] xl:p-5">
        <div className="pointer-events-auto flex items-center justify-between gap-3 glass rounded-card px-[18px] py-4">
          <Link href="/" className="min-w-0 whitespace-nowrap rounded-sm">
            <span className="block font-serif text-[27px] font-light leading-[1.05] tracking-[-0.03em]">
              Ask the code<span className="text-mark">.</span>
            </span>
            <span className="mt-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.22em] text-eyebrow">Cited to the line</span>
          </Link>
          {!wide && (
            <button type="button" onClick={() => setPlacesOpenOn(pathname)} aria-expanded={placesOpen} className="glass-pill min-h-11 rounded-full px-4 text-[14px] font-semibold">
              Places
            </button>
          )}
        </div>
        {wide && (
          <div className="pointer-events-auto flex min-h-0 flex-col">
            <Places repoId={repoId} conversationId={conversationId} />
          </div>
        )}
      </div>

      {wide && <TopBar repoId={repoId} conversationId={conversationId} />}
      <ApiStatus />

      <main
        aria-label="Chat"
        className="absolute inset-x-2 bottom-2 top-[104px] z-30 flex flex-col overflow-hidden rounded-card glass-strong sm:inset-x-3 xl:inset-x-auto xl:bottom-5 xl:right-5 xl:top-[84px] xl:w-[420px]"
      >
        {children}
      </main>

      {code && wide && (
        <aside aria-label="Code viewer" className="absolute bottom-5 left-[320px] right-[460px] top-[84px] z-30 overflow-hidden rounded-card bg-surface shadow-card">
          <CodePanel target={code} onClose={closeCode} />
        </aside>
      )}
      {!wide && (
        <>
          <Sheet open={placesOpen} onOpenChange={(open) => setPlacesOpenOn(open ? pathname : null)}>
            <SheetContent side="left" className="w-[320px] border-0 bg-bg p-3">
              <SheetTitle className="sr-only">Repos and conversations</SheetTitle>
              <Places repoId={repoId} conversationId={conversationId} />
            </SheetContent>
          </Sheet>
          <Sheet open={code !== null} onOpenChange={(open) => !open && closeCode()}>
            <SheetContent side="bottom" className="h-dvh max-h-dvh bg-surface p-0 [&>button]:hidden">
              <SheetTitle className="sr-only">Code viewer</SheetTitle>
              {code && <CodePanel target={code} onClose={closeCode} />}
            </SheetContent>
          </Sheet>
        </>
      )}
      <TraceDrawer repoId={repoId} />
    </div>
  );
}
