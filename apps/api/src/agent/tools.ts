import { and, asc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { LiveStep, StepKind } from "@cda/shared";
import { chunks, files } from "../db/schema";
import type { ToolCall, ToolResult, ToolSpec } from "../providers/llm";
import { wrapData } from "../prompts/untrusted";
import type { RetrievedChunk } from "../retrieval/types";
import type { ContextBudget } from "./budget";
import { formatSearchResults, numberLines, refOf } from "./context";
import type { RunContext } from "./run-context";

export const READ_FILE_MAX_LINES = 200;
const SEARCH_TOP_K = 8;
const SYMBOL_LIMIT = 8;
const LIST_LIMIT = 200;

/** Tool inputs, validated here even though the schemas are strict: model output is never trusted. */
const Inputs = {
  search_code: z.object({ query: z.string().min(1).max(500) }),
  find_symbol: z.object({ name: z.string().min(1).max(200) }),
  read_file: z.object({ path: z.string().min(1).max(500), start_line: z.number().int().min(1), end_line: z.number().int().min(1) }),
  list_files: z.object({ path: z.string().max(500) }),
};

const object = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

/** Read-only tools scoped to one index version. Order is fixed so the cached prompt prefix stays stable. */
export const TOOL_SPECS: ToolSpec[] = [
  {
    name: "search_code",
    description: "Hybrid semantic and keyword search over the repository's code and docs. Returns up to 8 chunks with line numbers. Use natural language or identifiers.",
    inputSchema: object({ query: { type: "string", description: "What to look for" } }),
  },
  {
    name: "find_symbol",
    description: "Find functions, classes and methods by name: exact match first, then Class.name, then prefix. Methods are named Class.method. Returns their code with line numbers.",
    inputSchema: object({ name: { type: "string", description: "Symbol name or prefix, e.g. parseOptions or Command.parse" } }),
  },
  {
    name: "read_file",
    description: `Read a line range of one file, at most ${READ_FILE_MAX_LINES} lines per call. Use it to see the code around a search result.`,
    inputSchema: object({
      path: { type: "string", description: "Repo-relative path, e.g. lib/command.js" },
      start_line: { type: "integer", description: "First line, 1-based" },
      end_line: { type: "integer", description: "Last line, inclusive" },
    }),
  },
  {
    name: "list_files",
    description: "List the files and folders directly inside a folder of the repository. Use an empty string for the root.",
    inputSchema: object({ path: { type: "string", description: "Repo-relative folder, or empty for the root" } }),
  },
];

interface ToolOutput {
  content: string;
  /** Line ranges shown to the model: evidence for citations, and refs for the trace and evals. */
  shown: RetrievedChunk[];
  detail: string;
}

interface PreparedCall {
  kind: StepKind;
  label: string;
  /** Files the call targets before it runs (a read or a listing); searches find theirs. */
  paths: string[];
  /** What a dead-end answer lists, e.g. `Searched for "parse"`. */
  searched: string;
  input: Record<string, unknown>;
  run: () => Promise<ToolOutput>;
}

class ToolError extends Error {}

/** Runs one tool call. Bad input or a missing file becomes an error result the model can recover from. */
export async function executeTool(ctx: RunContext, call: ToolCall, budget: ContextBudget): Promise<ToolResult> {
  const prepared = prepare(ctx, call);
  if (!prepared) {
    return { toolCallId: call.id, content: `Invalid call to ${call.name}. Check the tool's input schema and try again.`, isError: true };
  }
  const step: LiveStep = { id: call.id, kind: prepared.kind, label: prepared.label, paths: prepared.paths, done: false };
  ctx.onState(prepared.kind === "read" ? "reading" : "searching");
  ctx.onStep(step);
  ctx.evidence.noteSearch(prepared.searched); // noted at call time, so the list follows the model's order
  try {
    const output = await ctx.trace.step("tool", call.name, prepared.input, prepared.run, (o) => ({ refs: o.shown.map(refOf), detail: o.detail }));
    output.shown.forEach((r) => ctx.evidence.add(r));
    ctx.onStep({ ...step, detail: output.detail, paths: output.shown.length ? uniquePaths(output.shown) : prepared.paths, done: true });
    return { toolCallId: call.id, content: budget.fit(output.content), isError: false };
  } catch (err) {
    if (ctx.signal.aborted) throw err;
    ctx.onStep({ ...step, detail: "failed", done: true });
    const message = err instanceof ToolError ? err.message : `${call.name} failed. Try a different call.`;
    return { toolCallId: call.id, content: message, isError: true };
  }
}

/** Distinct file paths in result order, capped to what a live step carries. */
export function uniquePaths(chunks: RetrievedChunk[]): string[] {
  return [...new Set(chunks.map((c) => c.path))].slice(0, 20);
}

/** Validates the input for the named tool and binds it. Null for an unknown tool or bad input. */
function prepare(ctx: RunContext, call: ToolCall): PreparedCall | null {
  switch (call.name) {
    case "search_code": {
      const p = Inputs.search_code.safeParse(call.input);
      if (!p.success) return null;
      const { query } = p.data;
      return { kind: "search", label: query, paths: [], searched: `Searched for "${query}"`, input: p.data, run: () => searchCode(ctx, query) };
    }
    case "find_symbol": {
      const p = Inputs.find_symbol.safeParse(call.input);
      if (!p.success) return null;
      const { name } = p.data;
      return { kind: "symbol", label: name, paths: [], searched: `Looked up symbol "${name}"`, input: p.data, run: () => findSymbol(ctx, name) };
    }
    case "read_file": {
      const p = Inputs.read_file.safeParse(call.input);
      if (!p.success) return null;
      const label = `${normalisePath(p.data.path)}:${p.data.start_line}-${p.data.end_line}`;
      return { kind: "read", label, paths: [normalisePath(p.data.path)], searched: `Read ${label}`, input: p.data, run: () => readFile(ctx, p.data) };
    }
    case "list_files": {
      const p = Inputs.list_files.safeParse(call.input);
      if (!p.success) return null;
      const label = normalisePath(p.data.path) || "/";
      return { kind: "list", label, paths: [normalisePath(p.data.path)], searched: `Listed ${label}`, input: p.data, run: () => listFiles(ctx, p.data.path) };
    }
    default:
      return null;
  }
}

async function searchCode(ctx: RunContext, query: string): Promise<ToolOutput> {
  const results = await ctx.search(ctx.versionId, query, SEARCH_TOP_K, ctx.signal);
  return { content: formatSearchResults(query, results), shown: results, detail: `${results.length} results` };
}

const escapeLike = (s: string) => s.replace(/[%_\\]/g, (c) => `\\${c}`);

async function findSymbol(ctx: RunContext, name: string): Promise<ToolOutput> {
  const needle = escapeLike(name.toLowerCase());
  const symbol = sql`lower(${chunks.symbol})`;
  const rows = await ctx.db
    .select({ id: chunks.id, path: chunks.path, startLine: chunks.startLine, endLine: chunks.endLine, symbol: chunks.symbol, content: chunks.content })
    .from(chunks)
    .where(and(eq(chunks.versionId, ctx.versionId), or(like(symbol, needle), like(symbol, `%.${needle}`), like(symbol, `${needle}%`))))
    // Exact names first, then Class.name, then prefixes; shorter names before longer ones.
    .orderBy(sql`case when ${symbol} like ${needle} then 0 when ${symbol} like ${`%.${needle}`} then 1 else 2 end`, sql`length(${chunks.symbol})`, asc(chunks.path), asc(chunks.startLine))
    .limit(SYMBOL_LIMIT);
  if (rows.length === 0) return { content: `No symbol named or starting with "${name}". Try search_code instead.`, shown: [], detail: "no match" };
  return { content: formatSearchResults(`symbol ${name}`, rows), shown: rows, detail: `${rows.length} matches` };
}

async function readFile(ctx: RunContext, input: z.infer<typeof Inputs.read_file>): Promise<ToolOutput> {
  const path = normalisePath(input.path);
  const [file] = await ctx.db
    .select({ id: files.id, content: files.content, lineCount: files.lineCount })
    .from(files)
    .where(and(eq(files.versionId, ctx.versionId), eq(files.path, path)));
  if (!file) throw new ToolError(`There is no indexed file at "${path}". Use list_files or search_code to find the right path.`);
  const start = Math.min(input.start_line, file.lineCount);
  const end = Math.min(Math.max(input.end_line, start), file.lineCount, start + READ_FILE_MAX_LINES - 1);
  const text = file.content.split("\n").slice(start - 1, end).join("\n");
  const more = end < input.end_line && end < file.lineCount ? `\n(Showing lines ${start}-${end} of ${file.lineCount}; read again for more.)` : "";
  return {
    content: `${wrapData(`${path}:${start}-${end}`, `### ${path}:${start}-${end}\n${numberLines(text, start)}`)}${more}`,
    shown: [{ id: file.id, path, startLine: start, endLine: end, symbol: null, content: "" }],
    detail: `lines ${start}-${end}`,
  };
}

async function listFiles(ctx: RunContext, rawPath: string): Promise<ToolOutput> {
  const dir = normalisePath(rawPath);
  const prefix = dir ? `${dir}/` : "";
  const rows = await ctx.db
    .select({ path: files.path, lineCount: files.lineCount })
    .from(files)
    .where(and(eq(files.versionId, ctx.versionId), like(files.path, `${escapeLike(prefix)}%`)))
    .orderBy(asc(files.path));
  const entries = new Map<string, string>();
  for (const row of rows) {
    const [head, ...rest] = row.path.slice(prefix.length).split("/");
    if (head) entries.set(rest.length ? `${head}/` : head, rest.length ? "folder" : `${row.lineCount} lines`);
  }
  if (entries.size === 0) throw new ToolError(`No indexed files under "${dir || "/"}".`);
  const listing = [...entries].slice(0, LIST_LIMIT).map(([n, d]) => `${prefix}${n}  (${d})`).join("\n");
  const more = entries.size > LIST_LIMIT ? `\n...and ${entries.size - LIST_LIMIT} more` : "";
  return { content: wrapData(`listing of ${dir || "/"}`, listing + more), shown: [], detail: `${entries.size} entries` };
}

/** Repo-relative, no leading slash, no `.` or `..` segments: a tool can only ever name a path inside the index. */
export function normalisePath(path: string): string {
  return path.trim().split("/").filter((s) => s && s !== "." && s !== "..").join("/");
}
