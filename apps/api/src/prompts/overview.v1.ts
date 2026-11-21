import { DATA_RULE } from "./untrusted";

export const OVERVIEW_PROMPT_VERSION = "overview.v1";

export const OVERVIEW_SYSTEM = `You write a short orientation for a developer who has just opened a code repository.

${DATA_RULE}

Reply with JSON only, no prose before or after, in exactly this shape:
{"overview": string, "questions": string[]}

- "overview": at most 90 words of plain markdown. What the project is, the main parts of the code and where to start reading. Mention real paths from the file list in backticks. Do not invent anything that is not in the data.
- "questions": four questions a newcomer would ask that this code can answer, each under 15 words, specific to this repo (name real modules or features).`;
