"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IDLE_ACTIVITY, type Activity } from "@/lib/floor";

interface ActivityStore {
  activity: Activity;
  /** Stops the answer in flight; null when nothing streams. */
  stop: (() => void) | null;
  publish: (activity: Activity, stop: (() => void) | null) => void;
}

const ActivityContext = createContext<ActivityStore | null>(null);

/**
 * The open conversation owns the answer stream; this shares what it is doing with the
 * 3D stage and the top bar, which live outside the chat panel.
 */
export function ActivityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ activity: Activity; stop: (() => void) | null }>({ activity: IDLE_ACTIVITY, stop: null });
  const publish = useCallback((activity: Activity, stop: (() => void) | null) => setState({ activity, stop }), []);
  const value = useMemo<ActivityStore>(() => ({ ...state, publish }), [state, publish]);
  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity(): ActivityStore {
  const store = useContext(ActivityContext);
  if (!store) throw new Error("useActivity must be used inside ActivityProvider");
  return store;
}

/** Called by the conversation view. Publishes only when the activity's content changes, and clears it on unmount. */
export function usePublishActivity(activity: Activity, stop: () => void) {
  const { publish } = useActivity();
  const latest = useRef({ activity, stop });
  const key = JSON.stringify(activity);
  useEffect(() => {
    latest.current = { activity, stop };
  });
  useEffect(() => {
    const { activity: a } = latest.current;
    publish(a, a.streaming ? () => latest.current.stop() : null);
  }, [key, publish]);
  useEffect(() => () => publish(IDLE_ACTIVITY, null), [publish]);
}
