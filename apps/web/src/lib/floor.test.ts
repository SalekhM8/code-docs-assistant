import { describe, expect, it } from "vitest";
import type { LiveStep } from "@cda/shared";
import { assistantRoom, folderRooms, foldersOf, IDLE_ACTIVITY, MAX_ROOMS, OTHER_ROOM, ROOT_ROOM, roomOfPath } from "./floor";

const files = ["README.md", "package.json", "lib/command.js", "lib/option.js", "lib/help.js", "tests/a.test.js", "tests/b.test.js", "typings/index.d.ts"];
const step = (s: Partial<LiveStep>): LiveStep => ({ id: "1", kind: "search", label: "x", done: true, ...s });

describe("foldersOf", () => {
  it("groups by top-level folder, biggest first, root files together", () => {
    const folders = foldersOf(files);
    expect(folders.map((f) => f.id)).toEqual(["lib", ROOT_ROOM, "tests", "typings"]);
    expect(folders[0]?.files).toHaveLength(3);
  });

  it("puts hidden folders with everything else", () => {
    const folders = foldersOf([...files, ".github/workflows/ci.yml"]);
    expect(folders.at(-1)).toMatchObject({ id: OTHER_ROOM, files: [".github/workflows/ci.yml"] });
    expect(roomOfPath(".github/workflows/ci.yml", folders)).toBe(OTHER_ROOM);
  });

  it("caps the rooms and puts the rest in one", () => {
    const many = Array.from({ length: 10 }, (_, i) => `d${i}/f.js`);
    const folders = foldersOf(many);
    expect(folders).toHaveLength(MAX_ROOMS);
    expect(folders.at(-1)?.id).toBe(OTHER_ROOM);
    expect(roomOfPath("d9/f.js", folders)).toBe(OTHER_ROOM);
  });
});

describe("folderRooms", () => {
  const folders = foldersOf(files);

  it("is idle with no activity", () => {
    expect(folderRooms(folders, IDLE_ACTIVITY).every((r) => r.state === "idle")).toBe(true);
  });

  it("marks an unfinished read as reading and searched folders as working", () => {
    const rooms = folderRooms(folders, {
      orb: "reading",
      streaming: true,
      citations: [],
      steps: [step({ paths: ["tests/a.test.js"] }), step({ id: "2", kind: "read", done: false, paths: ["lib/command.js"] })],
    });
    expect(rooms.find((r) => r.id === "lib")?.state).toBe("reading");
    expect(rooms.find((r) => r.id === "tests")?.label).toBe("Searched");
    expect(rooms.find((r) => r.id === "typings")?.state).toBe("idle");
  });

  it("marks cited folders done once the answer is finished, ignoring invalid citations", () => {
    const rooms = folderRooms(folders, {
      orb: "done",
      streaming: false,
      steps: [],
      citations: [
        { path: "lib/help.js", startLine: 1, endLine: 2, valid: true },
        { path: "tests/a.test.js", startLine: 1, endLine: 2, valid: false },
      ],
    });
    expect(rooms.find((r) => r.id === "lib")?.label).toBe("Cited");
    expect(rooms.find((r) => r.id === "tests")?.state).toBe("idle");
  });
});

describe("assistantRoom", () => {
  const folders = foldersOf(files);
  it("follows the newest step with a path while streaming", () => {
    const steps = [step({ paths: ["tests/a.test.js"] }), step({ id: "2", paths: ["lib/help.js"] }), step({ id: "3", paths: [] })];
    expect(assistantRoom(folders, { orb: "searching", streaming: true, citations: [], steps })).toBe("lib");
  });

  it("stands by the first valid citation afterwards, else the middle", () => {
    const citations = [
      { path: "tests/a.test.js", startLine: 1, endLine: 2, valid: false },
      { path: "typings/index.d.ts", startLine: 1, endLine: 2, valid: true },
    ];
    expect(assistantRoom(folders, { orb: "idle", streaming: false, steps: [], citations })).toBe("typings");
    expect(assistantRoom(folders, IDLE_ACTIVITY)).toBeNull();
  });
});
