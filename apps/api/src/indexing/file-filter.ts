import path from "node:path";

export type SkipReason = "ignored_dir" | "lock_file" | "secret" | "binary" | "too_large" | "minified" | "unsupported";

/** Directories that hold build output, dependencies or vendored code. Never descended into. */
const IGNORED_DIRS = new Set([
  ".git", "node_modules", "vendor", "third_party", "third-party", "bower_components", "dist", "build", "out",
  ".next", ".nuxt", ".svelte-kit", "target", "coverage", "__pycache__", ".venv", "venv", ".tox", ".mypy_cache",
  ".pytest_cache", ".gradle", ".idea", ".vscode", "Pods", ".terraform", ".cache", ".turbo", ".yarn",
]);

const LOCK_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock", "cargo.lock", "poetry.lock",
  "pipfile.lock", "composer.lock", "gemfile.lock", "go.sum", "uv.lock", "flake.lock", "npm-shrinkwrap.json",
]);

const SECRET_NAME = [
  /^\.env(\..*)?$/, /\.pem$/, /\.key$/, /\.p12$/, /\.pfx$/, /\.keystore$/, /\.jks$/, /^id_(rsa|dsa|ecdsa|ed25519)$/,
  /^credentials(\.json)?$/, /^secrets?\.(json|ya?ml|toml)$/, /^\.netrc$/, /^\.npmrc$/, /^\.pypirc$/, /\.tfstate$/,
];

const SECRET_CONTENT = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, // GitHub token
  /\bsk-ant-[A-Za-z0-9_-]{20,}/, // Anthropic key
  /\bxox[abpr]-[A-Za-z0-9-]{10,}/, // Slack token
];

export function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name);
}

/** Decision from the path alone, before reading the file. */
export function skipByPath(relPath: string, sizeBytes: number, maxBytes: number): SkipReason | null {
  const base = path.basename(relPath).toLowerCase();
  if (LOCK_FILES.has(base)) return "lock_file";
  if (SECRET_NAME.some((re) => re.test(base))) return "secret";
  if (/\.min\.(js|css)$|\.map$|\.bundle\.js$/.test(base)) return "minified";
  if (sizeBytes > maxBytes) return "too_large";
  return null;
}

/** Decision from the bytes. A NUL byte in the first 8 KB is the same binary test git uses. */
export function skipByContent(buffer: Buffer): SkipReason | null {
  if (buffer.subarray(0, 8192).includes(0)) return "binary";
  const text = buffer.toString("utf8");
  if (SECRET_CONTENT.some((re) => re.test(text))) return "secret";
  if (looksMinified(text)) return "minified";
  return null;
}

function looksMinified(text: string): boolean {
  const lines = text.split("\n");
  return text.length > 5000 && lines.length < 10;
}
