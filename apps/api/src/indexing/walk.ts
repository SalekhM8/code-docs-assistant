import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../lib/errors";
import { countLines, sha256 } from "../lib/text";
import { isIgnoredDir, skipByContent, skipByPath, type SkipReason } from "./file-filter";
import { detectLanguage, type LanguageInfo } from "./languages";

export interface SourceFile {
  path: string;
  content: string;
  sizeBytes: number;
  lineCount: number;
  contentHash: string;
  lang: LanguageInfo;
}

export interface WalkResult {
  files: SourceFile[];
  skipped: Partial<Record<SkipReason, number>>;
}

export interface WalkLimits {
  maxFileBytes: number;
  maxFileCount: number;
  maxTotalBytes: number;
}

/** Collects every indexable file under `root`, applying the skip rules and the size and count limits. */
export async function walkRepo(root: string, limits: WalkLimits): Promise<WalkResult> {
  const files: SourceFile[] = [];
  const skipped: Partial<Record<SkipReason, number>> = {};
  let totalBytes = 0;
  const skip = (reason: SkipReason) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
  };

  for await (const rel of listFiles(root, "")) {
    const abs = path.join(root, rel);
    const stat = await lstat(abs);
    if (!stat.isFile()) continue; // symlinks and anything else are never followed
    const lang = detectLanguage(rel);
    if (!lang) {
      skip("unsupported");
      continue;
    }
    const byPath = skipByPath(rel, stat.size, limits.maxFileBytes);
    if (byPath) {
      skip(byPath);
      continue;
    }
    const buffer = await readFile(abs);
    const byContent = skipByContent(buffer);
    if (byContent) {
      skip(byContent);
      continue;
    }
    totalBytes += stat.size;
    if (files.length >= limits.maxFileCount || totalBytes > limits.maxTotalBytes) {
      throw new AppError("repo_too_large", `This repo has more indexable code than the limit (${limits.maxFileCount} files or ${Math.round(limits.maxTotalBytes / (1024 * 1024))} MB). Try a smaller repo.`);
    }
    const content = buffer.toString("utf8");
    files.push({ path: rel, content, sizeBytes: stat.size, lineCount: countLines(content), contentHash: sha256(content), lang });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, skipped };
}

async function* listFiles(root: string, rel: string): AsyncGenerator<string> {
  const entries = await readdir(path.join(root, rel), { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!isIgnoredDir(entry.name)) yield* listFiles(root, child);
    } else if (entry.isFile()) {
      yield child;
    }
  }
}
