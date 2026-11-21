import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import treeSitter from "@vscode/tree-sitter-wasm";
import type { Language, Node, Parser } from "@vscode/tree-sitter-wasm";
import type { Grammar } from "../languages";
import { windowChunks } from "./lines";
import { hasContent, MAX_CHUNK_LINES, sliceLines, type Chunk, type ChunkKind } from "./types";

/** Node types that start a chunk, across the bundled grammars. */
const DEFINITIONS: Record<string, ChunkKind> = {
  function_declaration: "function", generator_function_declaration: "function", function_definition: "function",
  function_item: "function", method_definition: "method", method_declaration: "method", method: "method",
  singleton_method: "method", constructor_declaration: "method",
  class_declaration: "class", abstract_class_declaration: "class", class_definition: "class", class: "class",
  module: "class", impl_item: "class", trait_item: "class", interface_declaration: "class", class_specifier: "class",
  struct_item: "type", enum_item: "type", enum_declaration: "type", type_alias_declaration: "type",
  type_declaration: "type", struct_specifier: "type", record_declaration: "class", namespace_declaration: "class",
};

/** Definitions whose members are split out when the whole is too long for one chunk. */
const CONTAINERS = new Set(["class", "type"]);

interface Definition {
  /** The full node, including any export or decorator wrapper; sets the line range. */
  node: Node;
  /** The declaration itself; holds the body to split. */
  inner: Node;
  name: string | null;
  kind: ChunkKind;
}

/** tree-sitter chunker: one chunk per function, class or method; large classes split by method. */
export class CodeChunker {
  private readonly languages = new Map<Grammar, Promise<Language>>();

  private constructor(private readonly parser: Parser, private readonly wasmDir: string) {}

  static async create(): Promise<CodeChunker> {
    const wasmDir = path.dirname(createRequire(import.meta.url).resolve("@vscode/tree-sitter-wasm"));
    await treeSitter.Parser.init({ locateFile: (file: string) => path.join(wasmDir, file) });
    return new CodeChunker(new treeSitter.Parser(), wasmDir);
  }

  async chunk(content: string, grammar: Grammar): Promise<Chunk[]> {
    this.parser.setLanguage(await this.language(grammar));
    const tree = this.parser.parse(content);
    const lines = content.split("\n");
    if (!tree) return windowChunks(lines, 1, lines.length);
    try {
      return chunkChildren(tree.rootNode.namedChildren, lines, null, 1, lines.length);
    } finally {
      tree.delete(); // trees live in WASM memory and are not garbage collected
    }
  }

  private language(grammar: Grammar): Promise<Language> {
    let lang = this.languages.get(grammar);
    if (!lang) {
      lang = readFile(path.join(this.wasmDir, `tree-sitter-${grammar}.wasm`)).then((bytes) => treeSitter.Language.load(bytes));
      this.languages.set(grammar, lang);
    }
    return lang;
  }
}

/**
 * Walks sibling nodes: definitions become chunks (with their leading comments), and the
 * code between definitions (imports, top-level statements, fields) becomes `module` chunks.
 */
function chunkChildren(children: (Node | null)[], lines: string[], parent: string | null, from: number, to: number): Chunk[] {
  const chunks: Chunk[] = [];
  let gapStart = from;
  let commentStart: number | null = null;

  for (const node of children) {
    if (!node) continue;
    const start = node.startPosition.row + 1;
    if (node.type.includes("comment")) {
      commentStart ??= start;
      continue;
    }
    const def = definitionOf(node);
    if (!def) {
      commentStart = null;
      continue;
    }
    const defStart = commentStart ?? start;
    commentStart = null;
    chunks.push(...gapChunks(lines, gapStart, defStart - 1, parent));
    chunks.push(...definitionChunks(def, lines, parent, defStart));
    gapStart = def.node.endPosition.row + 2;
  }
  chunks.push(...gapChunks(lines, gapStart, to, parent));
  return chunks;
}

function definitionChunks(def: Definition, lines: string[], parent: string | null, startLine: number): Chunk[] {
  const endLine = def.node.endPosition.row + 1;
  const symbol = [parent, def.name].filter(Boolean).join(".") || null;
  const kind: ChunkKind = parent && def.kind === "function" ? "method" : def.kind;
  if (endLine - startLine + 1 <= MAX_CHUNK_LINES) {
    return [{ startLine, endLine, symbol, kind, content: sliceLines(lines, startLine, endLine) }];
  }
  const body = def.inner.childForFieldName("body");
  if (CONTAINERS.has(def.kind) && body) {
    return chunkChildren(body.namedChildren, lines, symbol, startLine, endLine);
  }
  return windowChunks(lines, startLine, endLine, { size: MAX_CHUNK_LINES, overlap: 15, symbol, kind });
}

function gapChunks(lines: string[], from: number, to: number, parent: string | null): Chunk[] {
  if (to < from || !hasContent(sliceLines(lines, from, to))) return [];
  return windowChunks(lines, from, to, { size: MAX_CHUNK_LINES, overlap: 0, symbol: parent, kind: parent ? "class" : "module" });
}

/** Recognises a definition, unwrapping exports, decorators and `const x = () => {}` style bindings. */
function definitionOf(node: Node): Definition | null {
  if (node.type === "export_statement" || node.type === "decorated_definition") {
    const inner = node.childForFieldName("declaration") ?? node.childForFieldName("definition");
    const def = inner && definitionOf(inner);
    return def ? { ...def, node } : null;
  }
  if (node.type === "lexical_declaration" || node.type === "variable_declaration") {
    return boundFunction(node);
  }
  if (node.type === "expression_statement") {
    return assignedFunction(node);
  }
  const kind = DEFINITIONS[node.type];
  return kind ? { node, inner: node, name: nameOf(node), kind } : null;
}

const FUNCTION_VALUES = new Set(["arrow_function", "function_expression", "function", "class", "generator_function"]);

function boundFunction(node: Node): Definition | null {
  const declarator = node.namedChildren.find((c) => c?.type === "variable_declarator");
  const value = declarator?.childForFieldName("value");
  if (!declarator || !value || !FUNCTION_VALUES.has(value.type)) return null;
  return { node, inner: value, name: declarator.childForFieldName("name")?.text ?? null, kind: value.type === "class" ? "class" : "function" };
}

/** `exports.parse = function () {}` and `Foo.prototype.bar = () => {}`. */
function assignedFunction(node: Node): Definition | null {
  const expr = node.namedChildren[0];
  if (expr?.type !== "assignment_expression") return null;
  const value = expr.childForFieldName("right");
  if (!value || !FUNCTION_VALUES.has(value.type)) return null;
  return { node, inner: value, name: expr.childForFieldName("left")?.text ?? null, kind: "function" };
}

function nameOf(node: Node): string | null {
  const named = node.childForFieldName("name") ?? node.childForFieldName("type");
  if (named) return named.text;
  const declarator = node.childForFieldName("declarator");
  if (declarator) return declarator.text.split("(")[0]?.trim() ?? null;
  const spec = node.namedChildren.find((c) => c?.type === "type_spec");
  return spec?.childForFieldName("name")?.text ?? null;
}
