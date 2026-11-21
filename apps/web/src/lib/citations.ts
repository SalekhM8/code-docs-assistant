import type { Citation } from "@cda/shared";

/** Same grammar as the api's citation parser: [path:10-24] or [path:10]. */
const CITATION = /\[([^\s[\]:]+):(\d+)(?:-(\d+))?\](?!\()/g;
export const CITE_PREFIX = "#cite=";

/**
 * Rewrites citations into markdown links (`#cite=path:10-24`) so the renderer can turn them
 * into chips. Code spans and fenced blocks are left alone.
 */
export function linkifyCitations(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(CITATION, (_m, path: string, a: string, b?: string) => {
      const range = b ? `${a}-${b}` : a;
      return `[${path}:${range}](${CITE_PREFIX}${encodeURIComponent(`${path}:${range}`)})`;
    })))
    .join("");
}

export interface CiteTarget {
  path: string;
  startLine: number;
  endLine: number;
}

export function parseCiteHref(href: string | undefined): CiteTarget | null {
  if (!href?.startsWith(CITE_PREFIX)) return null;
  const m = /^(.+):(\d+)(?:-(\d+))?$/.exec(decodeURIComponent(href.slice(CITE_PREFIX.length)));
  if (!m?.[1]) return null;
  const startLine = Number(m[2]);
  return { path: m[1], startLine, endLine: m[3] ? Number(m[3]) : startLine };
}

/** The checker's verdict for a citation in the text; unknown while still streaming. */
export function verdictFor(target: CiteTarget, citations: Citation[]): Citation | undefined {
  return citations.find((c) => c.path === target.path && c.startLine === target.startLine && c.endLine === target.endLine);
}
