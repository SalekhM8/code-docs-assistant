import { sql } from "drizzle-orm";
import { JOB_STAGES, type JobProgress } from "@cda/shared";
import {
  type AnyPgColumn,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/** Every embedding model used here must output this many dimensions (voyage-code-4 default). */
export const EMBEDDING_DIMENSIONS = 1024;

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const repos = pgTable("repos", {
  id: id(),
  url: text("url").notNull(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  activeVersionId: uuid("active_version_id").references((): AnyPgColumn => indexVersions.id, { onDelete: "set null" }),
  overview: text("overview"),
  suggestedQuestions: jsonb("suggested_questions").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("repos_url_idx").on(t.url)]);

export const indexVersions = pgTable("index_versions", {
  id: id(),
  repoId: uuid("repo_id").notNull().references(() => repos.id, { onDelete: "cascade" }),
  commitSha: text("commit_sha").notNull(),
  embeddingModel: text("embedding_model").notNull(),
  status: text("status", { enum: ["building", "active"] }).notNull().default("building"),
  fileCount: integer("file_count").notNull().default(0),
  chunkCount: integer("chunk_count").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index("index_versions_repo_idx").on(t.repoId)]);

export const files = pgTable("files", {
  id: id(),
  versionId: uuid("version_id").notNull().references(() => indexVersions.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  language: text("language").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  lineCount: integer("line_count").notNull(),
  contentHash: text("content_hash").notNull(),
  content: text("content").notNull(),
}, (t) => [uniqueIndex("files_version_path_idx").on(t.versionId, t.path)]);

export const chunks = pgTable("chunks", {
  id: id(),
  versionId: uuid("version_id").notNull().references(() => indexVersions.id, { onDelete: "cascade" }),
  fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  startLine: integer("start_line").notNull(),
  endLine: integer("end_line").notNull(),
  symbol: text("symbol"),
  kind: text("kind").notNull(),
  language: text("language").notNull(),
  content: text("content").notNull(),
  contentHash: text("content_hash").notNull(),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  embeddingModel: text("embedding_model").notNull(),
  searchVector: tsvector("search_vector").notNull(),
}, (t) => [
  index("chunks_version_idx").on(t.versionId),
  index("chunks_file_idx").on(t.fileId),
  index("chunks_symbol_idx").on(t.versionId, sql`lower(${t.symbol}) text_pattern_ops`),
  index("chunks_embedding_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  index("chunks_search_gin_idx").using("gin", t.searchVector),
]);

export const indexJobs = pgTable("index_jobs", {
  id: id(),
  repoId: uuid("repo_id").notNull().references(() => repos.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["index", "reindex"] }).notNull(),
  status: text("status", { enum: ["queued", "running", "ready", "failed"] }).notNull().default("queued"),
  stage: text("stage", { enum: JOB_STAGES }).notNull().default("queued"),
  progress: jsonb("progress").$type<JobProgress>().notNull().default({ filesTotal: 0, filesDone: 0, filesReused: 0, chunks: 0 }),
  /** A specific commit to index (the seeded sample repo and evals). Null means the default branch head. */
  requestedCommit: text("requested_commit"),
  commitSha: text("commit_sha"),
  error: text("error"),
  createdAt: createdAt(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (t) => [index("index_jobs_repo_idx").on(t.repoId, t.createdAt)]);

export const conversations = pgTable("conversations", {
  id: id(),
  repoId: uuid("repo_id").notNull().references(() => repos.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  /** Rolling summary of turns older than the ones sent in full. */
  summary: text("summary"),
  summaryUpTo: integer("summary_up_to").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("conversations_repo_idx").on(t.repoId, t.updatedAt)]);

export const messages = pgTable("messages", {
  id: id(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: ["complete", "stopped", "failed", "not_found"] }).notNull().default("complete"),
  citations: jsonb("citations").$type<StoredCitation[]>().notNull().default([]),
  searched: jsonb("searched").$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
}, (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)]);

export interface StoredCitation {
  path: string;
  startLine: number;
  endLine: number;
  valid: boolean;
  reason?: string;
}

export const traces = pgTable("traces", {
  id: id(),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  mode: text("mode", { enum: ["baseline", "agent"] }).notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  outcome: text("outcome").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6, mode: "number" }),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("traces_message_idx").on(t.messageId)]);

export const traceSteps = pgTable("trace_steps", {
  id: id(),
  traceId: uuid("trace_id").notNull().references(() => traces.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  kind: text("kind", { enum: ["model", "tool", "retrieval", "citation_check"] }).notNull(),
  name: text("name").notNull(),
  input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
  output: jsonb("output").$type<Record<string, unknown>>().notNull().default({}),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
}, (t) => [index("trace_steps_trace_idx").on(t.traceId, t.position)]);

export const feedback = pgTable("feedback", {
  id: id(),
  traceId: uuid("trace_id").notNull().references(() => traces.id, { onDelete: "cascade" }),
  rating: text("rating", { enum: ["up", "down"] }).notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("feedback_trace_idx").on(t.traceId)]);

export const embeddingCache = pgTable("embedding_cache", {
  contentHash: text("content_hash").notNull(),
  model: text("model").notNull(),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.contentHash, t.model] })]);
