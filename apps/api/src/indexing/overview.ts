import { z } from "zod";
import type { Logger } from "../lib/logger";
import type { LlmProvider } from "../providers/llm";
import { OVERVIEW_SYSTEM } from "../prompts/overview.v1";
import { wrapData } from "../prompts/untrusted";
import type { SourceFile } from "./walk";

export interface RepoOverview {
  overview: string;
  questions: string[];
}

const OverviewJson = z.object({
  overview: z.string().min(1).max(2000),
  questions: z.array(z.string().min(3).max(200)).min(1).max(6),
});

const MAX_PATHS = 300;

/** Builds the overview with the cheap model. A bad or failed reply falls back to a plain summary. */
export async function generateOverview(llm: LlmProvider, repoName: string, files: SourceFile[], log: Logger): Promise<RepoOverview> {
  try {
    const result = await llm.complete({ tier: "cheap", system: OVERVIEW_SYSTEM, prompt: overviewPrompt(repoName, files), maxTokens: 2000 });
    const parsed = OverviewJson.safeParse(extractJson(result.text));
    if (parsed.success) return parsed.data;
    log.warn({ repoName }, "overview reply was not valid JSON; using fallback");
  } catch (err) {
    log.warn({ err, repoName }, "overview generation failed; using fallback");
  }
  return fallbackOverview(repoName, files);
}

export function overviewPrompt(repoName: string, files: SourceFile[]): string {
  const paths = files.slice(0, MAX_PATHS).map((f) => f.path).join("\n");
  const readme = files.find((f) => /^readme(\.md)?$/i.test(f.path));
  const manifest = files.find((f) => ["package.json", "pyproject.toml", "go.mod", "Cargo.toml"].includes(f.path));
  return [
    `Repository: ${repoName}`,
    wrapData("file list", paths),
    readme ? wrapData(readme.path, readme.content.slice(0, 6000)) : "",
    manifest ? wrapData(manifest.path, manifest.content.slice(0, 2000)) : "",
  ].filter(Boolean).join("\n\n");
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

export function fallbackOverview(repoName: string, files: SourceFile[]): RepoOverview {
  const counts = new Map<string, number>();
  files.forEach((f) => counts.set(f.lang.language, (counts.get(f.lang.language) ?? 0) + 1));
  const languages = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l]) => l).join(", ");
  const topDirs = [...new Set(files.map((f) => f.path.split("/")[0]).filter((d) => d && files.some((f) => f.path.startsWith(`${d}/`))))].slice(0, 5);
  return {
    overview: `${repoName} has ${files.length} indexed files (${languages}). Top-level folders: ${topDirs.map((d) => `\`${d}/\``).join(", ") || "none"}.`,
    questions: [
      "What does this project do, and where is its entry point?",
      "How is the code organised into modules?",
      "How are errors handled?",
      "How do I run the tests?",
    ],
  };
}
