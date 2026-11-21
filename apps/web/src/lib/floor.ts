import type { Citation, LiveStep, RepoSummary } from "@cda/shared";
import type { OrbState } from "./live-answer";

/*
 * The 3D stage is the White House floor view. On the home page each repo is a room;
 * inside a repo each top-level folder is a room. A room's state only ever comes from
 * real system state: indexing jobs, the live answer's steps, and the last answer's citations.
 */

export type RoomState = "idle" | "working" | "reading" | "done" | "failed";

export interface SceneRoom {
  id: string;
  name: string;
  /** Department colour from the house, used for the room's identity only. */
  color: string;
  state: RoomState;
  label: string;
  /** Shown on the room's sign under the state, e.g. "42 files". */
  meta: string;
}

/** The house's department colours, in the house's order (palmer-clone `model.ts` DEPTS). */
export const ROOM_COLORS = ["#2F8FE8", "#8B6CF0", "#E8559F", "#16B5A6", "#5E6B85", "#C98A1A", "#E55D40"] as const;

export const MAX_ROOMS = 6;
export const ROOT_ROOM = "/";
export const OTHER_ROOM = "*";

export interface Folder {
  id: string;
  name: string;
  files: string[];
}

const colorAt = (i: number) => ROOM_COLORS[i % ROOM_COLORS.length] ?? "#2F8FE8";

/**
 * Groups files by top-level folder, biggest first. Files at the root share one room. Hidden
 * folders (.github and the like) and anything past the cap share "Everything else".
 */
export function foldersOf(paths: string[]): Folder[] {
  const groups = new Map<string, string[]>();
  const hidden: string[] = [];
  for (const p of paths) {
    const slash = p.indexOf("/");
    const key = slash === -1 ? ROOT_ROOM : p.slice(0, slash);
    if (key.startsWith(".")) hidden.push(p);
    else groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const named = (id: string, files: string[]): Folder => ({ id, name: id === ROOT_ROOM ? "Root files" : `${id}/`, files });
  const fits = sorted.length + (hidden.length ? 1 : 0) <= MAX_ROOMS;
  const kept = fits ? sorted : sorted.slice(0, MAX_ROOMS - 1);
  const rest = [...(fits ? [] : sorted.slice(MAX_ROOMS - 1).flatMap(([, files]) => files)), ...hidden];
  return [...kept.map(([id, files]) => named(id, files)), ...(rest.length ? [{ id: OTHER_ROOM, name: "Everything else", files: rest }] : [])];
}

/** Which room a repo path belongs to. */
export function roomOfPath(path: string, folders: Folder[]): string | null {
  const slash = path.indexOf("/");
  const key = slash === -1 ? ROOT_ROOM : path.slice(0, slash);
  if (folders.some((f) => f.id === key)) return key;
  return folders.some((f) => f.id === OTHER_ROOM) ? OTHER_ROOM : null;
}

/** What the assistant is doing right now, or what its last answer cited. Published by the open conversation. */
export interface Activity {
  orb: OrbState;
  streaming: boolean;
  steps: LiveStep[];
  /** Citations of the latest finished answer; empty while streaming. */
  citations: Citation[];
}

export const IDLE_ACTIVITY: Activity = { orb: "idle", streaming: false, steps: [], citations: [] };

/**
 * Folder rooms for a repo. While an answer streams: the folder of an unfinished read is
 * "Reading", folders a step touched are "Searched". After it: folders the answer cites are "Cited".
 */
export function folderRooms(folders: Folder[], activity: Activity): SceneRoom[] {
  const touched = new Set<string>();
  const reading = new Set<string>();
  for (const s of activity.steps) {
    for (const p of s.paths ?? []) {
      const room = roomOfPath(p, folders);
      if (!room) continue;
      touched.add(room);
      if (s.kind === "read" && !s.done) reading.add(room);
    }
  }
  const cited = new Set(activity.citations.filter((c) => c.valid).map((c) => roomOfPath(c.path, folders)));
  return folders.map((f, i): SceneRoom => {
    const files = `${f.files.length} file${f.files.length === 1 ? "" : "s"}`;
    const base = { id: f.id, name: f.name, color: colorAt(i), meta: files };
    if (activity.streaming && reading.has(f.id)) return { ...base, state: "reading", label: "Reading" };
    if (activity.streaming && touched.has(f.id)) return { ...base, state: "working", label: "Searched" };
    if (!activity.streaming && cited.has(f.id)) return { ...base, state: "done", label: "Cited" };
    return { ...base, state: "idle", label: "Idle" };
  });
}

/**
 * Where the assistant stands: while streaming, the room of the newest step that touched a file;
 * afterwards, by the first folder the answer cited. Otherwise the corridor's middle.
 */
export function assistantRoom(folders: Folder[], activity: Activity): string | null {
  if (!activity.streaming) {
    const cited = activity.citations.find((c) => c.valid);
    return cited ? roomOfPath(cited.path, folders) : null;
  }
  for (const s of [...activity.steps].reverse()) {
    const first = s.paths?.[0];
    if (first) return roomOfPath(first, folders);
  }
  return null;
}

/** Repo rooms for the home floor: indexing repos are working, failed ones show it, ready ones are idle. */
export function repoRooms(repos: RepoSummary[]): SceneRoom[] {
  return repos.slice(0, 8).map((r, i): SceneRoom => {
    const base = { id: r.id, name: r.name, color: colorAt(i), meta: r.status === "ready" ? `${r.fileCount} files` : r.owner };
    if (r.status === "indexing") return { ...base, state: "working", label: "Indexing" };
    if (r.status === "failed") return { ...base, state: "failed", label: "Failed" };
    return { ...base, state: "idle", label: "Ready" };
  });
}
