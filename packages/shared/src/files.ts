import { z } from "zod";

export const FileEntry = z.object({ path: z.string(), language: z.string(), lineCount: z.number().int() });
export type FileEntry = z.infer<typeof FileEntry>;
export const FileList = z.array(FileEntry);

export const FileContent = FileEntry.extend({ content: z.string(), commitSha: z.string() });
export type FileContent = z.infer<typeof FileContent>;
