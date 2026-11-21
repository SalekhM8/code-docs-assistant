"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Two-step destructive action. An inline "Delete? Yes / No" instead of a browser confirm
 * dialog, so it is keyboard friendly and never blocks the page.
 */
export function ConfirmButton({ label, confirmLabel, onConfirm, children }: { label: string; confirmLabel: string; onConfirm: () => void; children: ReactNode }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={() => setAsking(true)}>
        {children}
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[12.5px]">
      <span className="text-red-text">{confirmLabel}</span>
      <Button variant="ghost" size="xs" className="text-red-text" onClick={() => { setAsking(false); onConfirm(); }} autoFocus>
        Yes
      </Button>
      <Button variant="ghost" size="xs" onClick={() => setAsking(false)}>
        No
      </Button>
    </span>
  );
}
