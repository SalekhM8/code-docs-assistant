"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Citation } from "@cda/shared";
import { linkifyCitations, parseCiteHref, verdictFor } from "@/lib/citations";
import { CitationChip } from "./citation-chip";

interface Props {
  text: string;
  repoId: string;
  /** null while streaming, or for text with no checked citations (the overview). */
  citations: Citation[] | null;
}

/** Answer text: high contrast and still once rendered. Citations become chips that open the code. */
export const Markdown = memo(function Markdown({ text, repoId, citations }: Props) {
  const components: Components = {
    a: ({ href, children }) => {
      const target = parseCiteHref(href);
      if (target) return <CitationChip target={target} verdict={citations ? verdictFor(target, citations) : undefined} repoId={repoId} />;
      return <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-text underline underline-offset-2">{children}</a>;
    },
    code: ({ children, className }) =>
      className ? <code className={className}>{children}</code> : <code className="rounded-code bg-surface-2 px-1 py-0.5 font-mono text-[0.92em] font-medium">{children}</code>,
    pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-item border-[1.5px] border-line bg-surface-2 p-3 font-mono text-[12.5px] leading-relaxed">{children}</pre>,
    p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
    h1: ({ children }) => <h3 className="mb-1 mt-4 text-[15px] font-semibold">{children}</h3>,
    h2: ({ children }) => <h3 className="mb-1 mt-4 text-[15px] font-semibold">{children}</h3>,
    h3: ({ children }) => <h3 className="mb-1 mt-3 text-[14px] font-semibold">{children}</h3>,
    table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-[13.5px] tabular-nums">{children}</table></div>,
    th: ({ children }) => <th className="border-b-[1.5px] border-text px-2 py-1 text-left font-semibold">{children}</th>,
    td: ({ children }) => <td className="border-b border-line px-2 py-1">{children}</td>,
  };
  return (
    <div className="text-[15px] leading-[1.6] text-text">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{linkifyCitations(text)}</ReactMarkdown>
    </div>
  );
});
