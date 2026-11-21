"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConversationSummary, RepoSummary } from "@cda/shared";
import { api } from "./api";

export const keys = {
  repos: ["repos"] as const,
  repo: (id: string) => ["repo", id] as const,
  conversations: (repoId: string) => ["conversations", repoId] as const,
  conversation: (id: string) => ["conversation", id] as const,
  files: (repoId: string) => ["files", repoId] as const,
  file: (repoId: string, path: string) => ["file", repoId, path] as const,
  trace: (id: string) => ["trace", id] as const,
};

/** Polls only while something is indexing, so progress is live and idle tabs stay quiet. */
export function useRepos() {
  return useQuery({
    queryKey: keys.repos,
    queryFn: api.repos,
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "indexing") ? 1000 : false),
  });
}

export function useRepo(id: string | undefined) {
  return useQuery({
    queryKey: keys.repo(id ?? ""),
    queryFn: () => api.repo(id ?? ""),
    enabled: Boolean(id),
    refetchInterval: (q) => (q.state.data?.status === "indexing" ? 1000 : false),
  });
}

export function useConversations(repoId: string | undefined) {
  return useQuery({ queryKey: keys.conversations(repoId ?? ""), queryFn: () => api.conversations(repoId ?? ""), enabled: Boolean(repoId) });
}

export function useConversation(id: string | undefined) {
  return useQuery({ queryKey: keys.conversation(id ?? ""), queryFn: () => api.conversation(id ?? ""), enabled: Boolean(id) });
}

export function useFiles(repoId: string | undefined, enabled: boolean) {
  return useQuery({ queryKey: keys.files(repoId ?? ""), queryFn: () => api.files(repoId ?? ""), enabled: Boolean(repoId) && enabled, staleTime: 60_000 });
}

export function useFile(repoId: string | undefined, path: string | null) {
  return useQuery({ queryKey: keys.file(repoId ?? "", path ?? ""), queryFn: () => api.file(repoId ?? "", path ?? ""), enabled: Boolean(repoId && path), staleTime: 60_000 });
}

export function useAddRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.addRepo,
    onSettled: () => qc.invalidateQueries({ queryKey: keys.repos }),
  });
}

export function useReindexRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.reindexRepo,
    onSettled: (_d, _e, id) => Promise.all([qc.invalidateQueries({ queryKey: keys.repos }), qc.invalidateQueries({ queryKey: keys.repo(id) })]),
  });
}

/** Optimistic: the repo disappears at once, and comes back if the delete fails. */
export function useDeleteRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteRepo,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.repos });
      const previous = qc.getQueryData<RepoSummary[]>(keys.repos);
      qc.setQueryData<RepoSummary[]>(keys.repos, (list) => list?.filter((r) => r.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => qc.setQueryData(keys.repos, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.repos }),
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createConversation,
    onSettled: (_d, _e, repoId) => qc.invalidateQueries({ queryKey: keys.conversations(repoId) }),
  });
}

/** Optimistic, like repo delete. */
export function useDeleteConversation(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteConversation,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.conversations(repoId) });
      const previous = qc.getQueryData<ConversationSummary[]>(keys.conversations(repoId));
      qc.setQueryData<ConversationSummary[]>(keys.conversations(repoId), (list) => list?.filter((c) => c.id !== id));
      return { previous };
    },
    onError: (_e, _id, ctx) => qc.setQueryData(keys.conversations(repoId), ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.conversations(repoId) }),
  });
}
