import path from "node:path";

/** Grammar file names shipped by @vscode/tree-sitter-wasm. */
export type Grammar = "typescript" | "tsx" | "javascript" | "python" | "go" | "rust" | "java" | "c-sharp" | "cpp" | "ruby" | "php";

export type ChunkStrategy = "code" | "markdown" | "lines";

export interface LanguageInfo {
  language: string;
  strategy: ChunkStrategy;
  grammar?: Grammar;
}

const BY_EXTENSION: Record<string, LanguageInfo> = {
  ".ts": { language: "typescript", strategy: "code", grammar: "typescript" },
  ".mts": { language: "typescript", strategy: "code", grammar: "typescript" },
  ".cts": { language: "typescript", strategy: "code", grammar: "typescript" },
  ".tsx": { language: "tsx", strategy: "code", grammar: "tsx" },
  ".js": { language: "javascript", strategy: "code", grammar: "javascript" },
  ".mjs": { language: "javascript", strategy: "code", grammar: "javascript" },
  ".cjs": { language: "javascript", strategy: "code", grammar: "javascript" },
  ".jsx": { language: "javascript", strategy: "code", grammar: "javascript" },
  ".py": { language: "python", strategy: "code", grammar: "python" },
  ".go": { language: "go", strategy: "code", grammar: "go" },
  ".rs": { language: "rust", strategy: "code", grammar: "rust" },
  ".java": { language: "java", strategy: "code", grammar: "java" },
  ".cs": { language: "csharp", strategy: "code", grammar: "c-sharp" },
  ".cpp": { language: "cpp", strategy: "code", grammar: "cpp" },
  ".cc": { language: "cpp", strategy: "code", grammar: "cpp" },
  ".hpp": { language: "cpp", strategy: "code", grammar: "cpp" },
  ".c": { language: "c", strategy: "code", grammar: "cpp" },
  ".h": { language: "c", strategy: "code", grammar: "cpp" },
  ".rb": { language: "ruby", strategy: "code", grammar: "ruby" },
  ".php": { language: "php", strategy: "code", grammar: "php" },
  ".md": { language: "markdown", strategy: "markdown" },
  ".mdx": { language: "markdown", strategy: "markdown" },
};

const PLAIN: Record<string, string> = {
  ".json": "json", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml", ".ini": "ini", ".cfg": "ini",
  ".sh": "bash", ".bash": "bash", ".zsh": "bash", ".css": "css", ".scss": "scss", ".html": "html",
  ".sql": "sql", ".txt": "text", ".rst": "text", ".kt": "kotlin", ".swift": "swift", ".scala": "scala",
  ".vue": "vue", ".svelte": "svelte", ".xml": "xml", ".gradle": "groovy", ".lua": "lua", ".ex": "elixir",
  ".exs": "elixir", ".erl": "erlang", ".hs": "haskell", ".clj": "clojure", ".dart": "dart", ".r": "r",
  ".pl": "perl", ".graphql": "graphql", ".prisma": "prisma", ".proto": "protobuf", ".tf": "terraform", ".dockerfile": "dockerfile",
};

const BY_NAME: Record<string, string> = {
  dockerfile: "dockerfile", makefile: "makefile", license: "text", "license.md": "markdown", ".gitignore": "text",
  ".editorconfig": "ini", ".npmrc": "ini", ".nvmrc": "text", procfile: "text",
};

/** Returns null for files we do not index at all (unknown extension). */
export function detectLanguage(filePath: string): LanguageInfo | null {
  const base = path.basename(filePath).toLowerCase();
  const ext = path.extname(base);
  const known = BY_EXTENSION[ext];
  if (known) return known;
  const plain = PLAIN[ext] ?? BY_NAME[base];
  return plain ? { language: plain, strategy: "lines" } : null;
}
