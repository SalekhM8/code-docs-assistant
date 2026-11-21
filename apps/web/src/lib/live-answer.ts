import type { AnswerMode, LiveStep, Message, StreamEvent } from "@cda/shared";

export type OrbState = "idle" | "searching" | "reading" | "answering" | "done" | "failed";

export const ORB_LABEL: Record<OrbState, string> = {
  idle: "Ready",
  searching: "Searching the code",
  reading: "Reading a file",
  answering: "Writing the answer",
  done: "Done",
  failed: "Something went wrong",
};

/** The in-flight answer, built only from stream events, so the UI shows real system state. */
export interface LiveAnswer {
  mode: AnswerMode;
  question: string;
  orb: OrbState;
  steps: LiveStep[];
  text: string;
  userMessage: Message | null;
  final: Message | null;
  error: string | null;
}

export function startLive(question: string, mode: AnswerMode): LiveAnswer {
  return { mode, question, orb: "searching", steps: [], text: "", userMessage: null, final: null, error: null };
}

export function reduceLive(live: LiveAnswer, event: StreamEvent): LiveAnswer {
  switch (event.type) {
    case "start":
      return { ...live, userMessage: event.userMessage, mode: event.mode };
    case "status":
      return { ...live, orb: event.state };
    case "step": {
      const exists = live.steps.some((s) => s.id === event.step.id);
      return { ...live, steps: exists ? live.steps.map((s) => (s.id === event.step.id ? event.step : s)) : [...live.steps, event.step] };
    }
    case "text":
      return { ...live, text: live.text + event.delta };
    case "reset":
      return { ...live, text: "" };
    case "done":
      return { ...live, final: event.message, orb: event.message.status === "failed" ? "failed" : "done" };
    case "error":
      return { ...live, error: event.message, orb: "failed" };
  }
}
