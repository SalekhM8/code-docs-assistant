import { StreamEvent } from "@cda/shared";

/**
 * Incremental Server Sent Events parser for a fetch body. EventSource cannot POST or be
 * aborted per request, so the stream is read by hand. Each frame is zod-validated.
 */
export class SseParser {
  private buffer = "";

  push(chunk: string): StreamEvent[] {
    this.buffer += chunk.replaceAll("\r\n", "\n");
    const frames = this.buffer.split("\n\n");
    this.buffer = frames.pop() ?? "";
    return frames.flatMap(parseFrame);
  }
}

function parseFrame(frame: string): StreamEvent[] {
  const data = frame
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trimStart())
    .join("\n");
  if (!data) return [];
  const parsed = StreamEvent.safeParse(JSON.parse(data));
  return parsed.success ? [parsed.data] : [];
}
