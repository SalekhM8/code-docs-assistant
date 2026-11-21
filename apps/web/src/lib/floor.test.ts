import { describe, expect, it } from "vitest";
import type { LiveStep } from "@cda/shared";
import { assistantRoom, folderRooms, foldersOf, IDLE_ACTIVITY, MAX_ROOMS, OTHER_ROOM, ROOT_ROOM, isRoleLayout, roleOf, roomOfPath } from "./floor";

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
    expect(folders.at(-1)).toMatchObject({ id: OTHER_ROOM, name: ".github/", files: [".github/workflows/ci.yml"] });
    expect(roomOfPath(".github/workflows/ci.yml", folders)).toBe(OTHER_ROOM);
  });

  it("caps the rooms and puts the rest in one", () => {
    const many = Array.from({ length: 10 }, (_, i) => `d${i}/f.js`);
    const folders = foldersOf(many);
    expect(folders).toHaveLength(MAX_ROOMS);
    expect(folders.at(-1)).toMatchObject({ id: OTHER_ROOM, name: "Everything else" });
    expect(roomOfPath("d9/f.js", folders)).toBe(OTHER_ROOM);
  });
});

describe("flat repos", () => {
  // slugify's shape: everything at the root plus .github.
  const flat = ["index.js", "index.d.ts", "test.js", "readme.md", "license", "package.json", ".editorconfig", ".github/workflows/main.yml", "overridable-replacements.js"];

  it("are grouped by role, in a fixed order", () => {
    const folders = foldersOf(flat);
    expect(folders.map((f) => f.name)).toEqual(["Source", "Tests", "Docs", "Config"]);
    expect(folders.find((f) => f.id === "source")?.files).toEqual(["index.js", "index.d.ts", "overridable-replacements.js"]);
    expect(roomOfPath(".github/workflows/main.yml", folders)).toBe("config");
    expect(roomOfPath(".github", folders)).toBe("config");
    expect(isRoleLayout(folders)).toBe(true);
    expect(isRoleLayout(foldersOf(files))).toBe(false);
  });

  it("classify common test, doc and config names", () => {
    expect(roleOf("src/parse.test.ts")).toBe("tests");
    expect(roleOf("__tests__/a.js")).toBe("tests");
    expect(roleOf("CHANGELOG.md")).toBe("docs");
    expect(roleOf("vite.config.ts")).toBe("config");
    expect(roleOf("Makefile")).toBe("config");
    expect(roleOf("lib/command.js")).toBe("source");
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
