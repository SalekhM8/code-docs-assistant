"use client";

import { useState } from "react";
import { FolderTree, X } from "lucide-react";
import type { CodeTarget } from "@/components/panels";
import { usePanels } from "@/components/panels";
import { Button } from "@/components/ui/button";
import { useFile } from "@/lib/queries";
import { shortSha } from "@/lib/repo-status";
import { CodeView } from "./code-view";
import { FileTree } from "./file-tree";

/** Default export so the shell can load it lazily with next/dynamic. */
export default function CodePanel({ target, onClose }: { target: CodeTarget; onClose: () => void }) {
  const { openCode } = usePanels();
  const [browsing, setBrowsing] = useState(false);
  const file = useFile(target.repoId, target.path);
  const range = target.startLine ? `:${target.startLine}${target.endLine && target.endLine !== target.startLine ? `-${target.endLine}` : ""}` : "";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b-[1.5px] border-line px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[13px] font-semibold">{target.path}<span className="text-text-dim">{range}</span></p>
          <p className="text-[11.5px] text-text-dim">{file.data ? `${file.data.lineCount} lines · commit ${shortSha(file.data.commitSha)}` : " "}</p>
        </div>
        <Button variant={browsing ? "default" : "ghost"} size="icon-sm" onClick={() => setBrowsing((b) => !b)} aria-pressed={browsing} aria-label="Browse files" title="Browse files">
          <FolderTree />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close the code viewer" title="Close">
          <X />
        </Button>
      </header>
      {browsing ? (
        <FileTree
          repoId={target.repoId}
          activePath={target.path}
          onOpen={(path) => {
            openCode({ repoId: target.repoId, path });
            setBrowsing(false);
          }}
        />
      ) : (
        <CodeView repoId={target.repoId} path={target.path} startLine={target.startLine} endLine={target.endLine} />
      )}
    </div>
  );
}
