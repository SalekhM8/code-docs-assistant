import { windowChunks } from "./lines";
import { hasContent, MAX_CHUNK_LINES, sliceLines, type Chunk } from "./types";

interface Section {
  heading: string | null;
  startLine: number;
}

/** One chunk per heading section. Headings inside fenced code blocks are not headings. */
export function chunkMarkdown(content: string): Chunk[] {
  const lines = content.split("\n");
  const sections = findSections(lines);
  return sections.flatMap((section, i) => {
    const endLine = (sections[i + 1]?.startLine ?? lines.length + 1) - 1;
    const text = sliceLines(lines, section.startLine, endLine);
    if (!hasContent(text)) return [];
    if (endLine - section.startLine + 1 > MAX_CHUNK_LINES) {
      return windowChunks(lines, section.startLine, endLine, { symbol: section.heading, kind: "section" });
    }
    return [{ startLine: section.startLine, endLine, symbol: section.heading, kind: "section" as const, content: text }];
  });
}

function findSections(lines: string[]): Section[] {
  const sections: Section[] = [{ heading: null, startLine: 1 }];
  let inFence = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const match = inFence ? null : /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match?.[1]) return;
    if (i === 0) sections[0] = { heading: match[1], startLine: 1 };
    else sections.push({ heading: match[1], startLine: i + 1 });
  });
  return sections;
}
