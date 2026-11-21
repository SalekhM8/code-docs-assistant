"use client";

import { useEffect, useState } from "react";

export interface Token {
  content: string;
  color?: string;
}

/** Our language names -> shiki grammar ids. Anything else renders as plain text. */
const SHIKI_LANG: Record<string, string> = {
  typescript: "typescript", tsx: "tsx", javascript: "javascript", python: "python", go: "go", rust: "rust", java: "java",
  csharp: "csharp", cpp: "cpp", c: "c", ruby: "ruby", php: "php", markdown: "markdown", json: "json", yaml: "yaml",
  toml: "toml", ini: "ini", bash: "bash", css: "css", scss: "scss", html: "html", sql: "sql", dockerfile: "docker",
  makefile: "make", kotlin: "kotlin", swift: "swift", vue: "vue", svelte: "svelte", xml: "xml", lua: "lua", graphql: "graphql",
};

/** Files larger than this are shown unhighlighted: tokenising them would stall the main thread. */
const MAX_HIGHLIGHT_CHARS = 400_000;

/**
 * Highlights with shiki, imported on first use so the highlighter and its grammars stay out
 * of the main bundle. Returns null until ready; the caller renders plain lines meanwhile.
 */
export function useHighlightedLines(code: string | undefined, language: string | undefined): Token[][] | null {
  const [lines, setLines] = useState<{ code: string; tokens: Token[][] } | null>(null);
  useEffect(() => {
    const lang = language ? SHIKI_LANG[language] : undefined;
    if (!code || !lang || code.length > MAX_HIGHLIGHT_CHARS) return;
    let cancelled = false;
    void import("shiki")
      .then(({ codeToTokens }) => codeToTokens(code, { lang: lang as never, theme: "github-light" }))
      .then((result) => !cancelled && setLines({ code, tokens: result.tokens.map((l) => l.map((t) => ({ content: t.content, color: t.color }))) }))
      .catch(() => undefined); // plain text is a fine fallback
    return () => {
      cancelled = true;
    };
  }, [code, language]);
  return lines && lines.code === code ? lines.tokens : null;
}
