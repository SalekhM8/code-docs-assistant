/**
 * A question typed on the repo page before its conversation existed. The chat view picks it
 * up once and sends it. In memory only: it lives for one client-side navigation.
 */
const pending = new Map<string, { content: string; mode: "baseline" | "agent" }>();

export const setPendingQuestion = (conversationId: string, q: { content: string; mode: "baseline" | "agent" }) => pending.set(conversationId, q);

export function takePendingQuestion(conversationId: string) {
  const q = pending.get(conversationId);
  pending.delete(conversationId);
  return q;
}
