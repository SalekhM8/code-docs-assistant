/**
 * The citation grammar shared by the api's checker and the web renderer:
 * `[path:10-24]` or `[path:10]`.
 *
 * A path may contain spaces and one level of square brackets, so files such as
 * `my notes.md` and Next.js routes such as `app/[id]/page.tsx` can be cited. It cannot
 * contain a colon or a newline, and cannot start with a space.
 */
export const CITATION_SOURCE = String.raw`\[((?!\s)(?:[^\[\]:\n]|\[[^\[\]:\n]*\])+?):(\d+)(?:-(\d+))?\]`;
