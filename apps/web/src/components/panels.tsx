"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface CodeTarget {
  repoId: string;
  path: string;
  startLine?: number;
  endLine?: number;
}

interface Panels {
  code: CodeTarget | null;
  openCode: (target: CodeTarget) => void;
  closeCode: () => void;
  traceId: string | null;
  openTrace: (traceId: string) => void;
  closeTrace: () => void;
}

const PanelsContext = createContext<Panels | null>(null);

/** Which side panels are open: the code viewer (with a highlighted range) and the trace drawer. */
export function PanelsProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<CodeTarget | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const closeCode = useCallback(() => setCode(null), []);
  const closeTrace = useCallback(() => setTraceId(null), []);
  const value = useMemo(() => ({ code, openCode: setCode, closeCode, traceId, openTrace: setTraceId, closeTrace }), [code, closeCode, traceId, closeTrace]);
  return <PanelsContext.Provider value={value}>{children}</PanelsContext.Provider>;
}

export function usePanels(): Panels {
  const panels = useContext(PanelsContext);
  if (!panels) throw new Error("usePanels must be used inside PanelsProvider");
  return panels;
}
