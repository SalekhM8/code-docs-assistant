"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { usePanels } from "@/components/panels";
import { Sidebar } from "@/components/sidebar/sidebar";
import { useMediaQuery } from "@/hooks/use-media-query";

// Loaded on the first citation click, with the syntax highlighter inside it.
const CodePanel = dynamic(() => import("@/components/code/code-panel"), {
  ssr: false,
  loading: () => <p className="p-6 text-[13px] text-text-dim">Opening the code viewer…</p>,
});

/** Repos and conversations on the left, chat in the centre, code on the right (a full-screen sheet on narrow screens). */
export function AppShell({ children }: { children: ReactNode }) {
  const { code, closeCode } = usePanels();
  const wide = useMediaQuery("(min-width: 1024px)");
  // The mobile nav is open for the path it was opened on, so navigating closes it.
  const pathname = usePathname();
  const [navOpenOn, setNavOpenOn] = useState<string | null>(null);
  const navOpen = navOpenOn === pathname;
  const setNavOpen = (open: boolean) => setNavOpenOn(open ? pathname : null);

  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden w-[280px] shrink-0 border-r-[1.5px] border-line md:block">
        <Sidebar />
      </div>
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[300px] bg-surface p-0">
          <SheetTitle className="sr-only">Repos and conversations</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b-[1.5px] border-line bg-surface px-3 py-2 md:hidden">
          <Button variant="ghost" size="icon-sm" aria-label="Open repos and conversations" onClick={() => setNavOpen(true)}>
            <Menu />
          </Button>
          <span className="font-serif text-[17px] font-light">Ask the code<span className="text-mark">.</span></span>
        </div>
        {children}
      </main>

      {code && wide && (
        <aside className="w-[clamp(380px,42vw,780px)] shrink-0 border-l-[1.5px] border-line bg-surface" aria-label="Code viewer">
          <CodePanel target={code} onClose={closeCode} />
        </aside>
      )}
      {!wide && (
        <Sheet open={code !== null} onOpenChange={(open) => !open && closeCode()}>
          <SheetContent side="bottom" className="h-dvh max-h-dvh bg-surface p-0 [&>button]:hidden">
            <SheetTitle className="sr-only">Code viewer</SheetTitle>
            {code && <CodePanel target={code} onClose={closeCode} />}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
