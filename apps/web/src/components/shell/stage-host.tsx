"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useActivity } from "@/components/activity";
import { usePanels } from "@/components/panels";
import { SceneBoundary } from "@/components/scene/scene-boundary";
import type { Insets } from "@/components/scene/stage";
import { assistantRoom, folderRooms, foldersOf, IDLE_ACTIVITY, isRoleLayout, repoRooms, type SceneRoom } from "@/lib/floor";
import { useFiles, useRepo, useRepos } from "@/lib/queries";

// three.js loads after the panels, so it never delays the chat or the first streamed words.
const Stage = dynamic(() => import("@/components/scene/stage"), { ssr: false });

// The house's panel sizes: a 320px Places column and a 420px side panel, 20px from the edge.
const INSETS: Insets = { left: 320, right: 460 };

/** Chooses the floor for the current page: repos on the home page, a repo's folders inside it. */
export function StageHost({ repoId, conversationId }: { repoId?: string; conversationId?: string }) {
  const repos = useRepos();
  const repo = useRepo(repoId);
  const ready = repo.data?.status === "ready";
  const files = useFiles(repoId, ready);
  const { activity } = useActivity();
  const { openCode, code } = usePanels();
  const router = useRouter();

  const folders = useMemo(() => foldersOf((files.data ?? []).map((f) => f.path).sort()), [files.data]);
  // Only the open conversation's answer moves things, and only on its own repo's floor.
  const live = conversationId ? activity : IDLE_ACTIVITY;

  const floor = useMemo((): { rooms: SceneRoom[]; assistant: string | null; hint: string } => {
    if (!repoId) {
      const rooms = repoRooms(repos.data ?? []);
      return { rooms, assistant: null, hint: rooms.length ? "Each room is a repo. Click one to go in." : "Add a public GitHub repo on the left to give it a room." };
    }
    if (!repo.data) return { rooms: [], assistant: null, hint: "Opening the repo…" };
    if (repo.data.status === "indexing") return { rooms: repoRooms([repo.data]), assistant: null, hint: `Indexing ${repo.data.name}. Its folders appear here when it is ready.` };
    if (repo.data.status === "failed") return { rooms: repoRooms([repo.data]), assistant: null, hint: `${repo.data.name} failed to index. Retry from the panel on the right.` };
    return {
      rooms: folderRooms(folders, live),
      assistant: assistantRoom(folders, live),
      hint: isRoleLayout(folders)
        ? "A flat repo, so each room is a kind of file: source, tests, docs, config. The assistant walks to what it reads."
        : "Each room is a top-level folder. The assistant walks to what it reads.",
    };
  }, [repoId, repos.data, repo.data, folders, live]);

  const select = (id: string) => {
    if (!repoId) return router.push(`/repos/${id}`);
    const first = folders.find((f) => f.id === id)?.files[0];
    if (first) openCode({ repoId, path: first });
  };

  return (
    <>
      <SceneBoundary>
        <Stage rooms={floor.rooms} assistantRoomId={floor.assistant} orb={live.orb} insets={INSETS} onSelect={select} />
      </SceneBoundary>
      {!code && (
        <p
          className="absolute bottom-5 z-20 max-w-[calc(100%-820px)] -translate-x-1/2 glass rounded-full px-5 py-[13px] text-center text-[13.5px] font-medium leading-snug "
          style={{ left: `calc(${INSETS.left}px + (100% - ${INSETS.left + INSETS.right}px) / 2)` }}
        >
          {floor.hint}
        </p>
      )}
    </>
  );
}
