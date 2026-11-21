import { z } from "zod";

/** Inlined at build time by Next, so it is read once here and validated. */
export const API_URL = z.string().url().parse(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787");
