import { and, asc, eq } from "drizzle-orm";
import type { FileContent, FileEntry } from "@cda/shared";
import type { Db } from "../db/client";
import { files, indexVersions } from "../db/schema";
import { notFound } from "../lib/errors";
import type { RepoService } from "./repos";

/** Read access to the active index version, for the code viewer. */
export class FileService {
  constructor(private readonly deps: { db: Db; repos: RepoService }) {}

  async list(repoId: string): Promise<FileEntry[]> {
    const { versionId } = await this.deps.repos.requireReady(repoId);
    return this.deps.db
      .select({ path: files.path, language: files.language, lineCount: files.lineCount })
      .from(files)
      .where(eq(files.versionId, versionId))
      .orderBy(asc(files.path));
  }

  async get(repoId: string, path: string): Promise<FileContent> {
    const { versionId } = await this.deps.repos.requireReady(repoId);
    const [row] = await this.deps.db
      .select({ path: files.path, language: files.language, lineCount: files.lineCount, content: files.content, commitSha: indexVersions.commitSha })
      .from(files)
      .innerJoin(indexVersions, eq(indexVersions.id, files.versionId))
      .where(and(eq(files.versionId, versionId), eq(files.path, path)));
    if (!row) throw notFound(`The file ${path}`);
    return row;
  }
}
