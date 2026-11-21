CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"path" text NOT NULL,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL,
	"symbol" text,
	"kind" text NOT NULL,
	"language" text NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"embedding_model" text NOT NULL,
	"search_vector" "tsvector" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"summary_up_to" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embedding_cache" (
	"content_hash" text NOT NULL,
	"model" text NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "embedding_cache_content_hash_model_pk" PRIMARY KEY("content_hash","model")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" uuid NOT NULL,
	"rating" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"path" text NOT NULL,
	"language" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"line_count" integer NOT NULL,
	"content_hash" text NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "index_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'queued' NOT NULL,
	"progress" jsonb DEFAULT '{"filesTotal":0,"filesDone":0,"filesReused":0,"chunks":0}'::jsonb NOT NULL,
	"commit_sha" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "index_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"commit_sha" text NOT NULL,
	"embedding_model" text NOT NULL,
	"status" text DEFAULT 'building' NOT NULL,
	"file_count" integer DEFAULT 0 NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'complete' NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"searched" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"pinned_commit" text,
	"active_version_id" uuid,
	"overview" text,
	"suggested_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trace_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trace_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"outcome" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6),
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_version_id_index_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."index_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_trace_id_traces_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."traces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_version_id_index_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."index_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_jobs" ADD CONSTRAINT "index_jobs_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_versions" ADD CONSTRAINT "index_versions_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_active_version_id_index_versions_id_fk" FOREIGN KEY ("active_version_id") REFERENCES "public"."index_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trace_steps" ADD CONSTRAINT "trace_steps_trace_id_traces_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."traces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traces" ADD CONSTRAINT "traces_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traces" ADD CONSTRAINT "traces_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_version_idx" ON "chunks" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "chunks_file_idx" ON "chunks" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "chunks_symbol_idx" ON "chunks" USING btree ("version_id",lower("symbol") text_pattern_ops);--> statement-breakpoint
CREATE INDEX "chunks_embedding_hnsw_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "chunks_search_gin_idx" ON "chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "conversations_repo_idx" ON "conversations" USING btree ("repo_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_trace_idx" ON "feedback" USING btree ("trace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_version_path_idx" ON "files" USING btree ("version_id","path");--> statement-breakpoint
CREATE INDEX "index_jobs_repo_idx" ON "index_jobs" USING btree ("repo_id","created_at");--> statement-breakpoint
CREATE INDEX "index_versions_repo_idx" ON "index_versions" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_url_idx" ON "repos" USING btree ("url");--> statement-breakpoint
CREATE INDEX "trace_steps_trace_idx" ON "trace_steps" USING btree ("trace_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "traces_message_idx" ON "traces" USING btree ("message_id");