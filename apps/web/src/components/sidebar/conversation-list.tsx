"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConversations, useCreateConversation, useDeleteConversation, useRepo } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "./confirm-button";

export function ConversationList({ repoId, activeId }: { repoId: string; activeId?: string }) {
  const repo = useRepo(repoId);
  const conversations = useConversations(repoId);
  const create = useCreateConversation();
  const del = useDeleteConversation(repoId);
  const router = useRouter();
  const ready = repo.data?.status === "ready";

  return (
    <section aria-label="Conversations" className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-eyebrow">Conversations</h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={!ready || create.isPending}
          onClick={() => create.mutate(repoId, { onSuccess: (c) => router.push(`/repos/${repoId}/c/${c.id}`) })}
        >
          <MessageSquarePlus /> New
        </Button>
      </div>
      {create.isError && <p role="alert" className="px-1 text-[12.5px] text-red-text">{create.error.message}</p>}
      {conversations.data?.length === 0 && <p className="px-1 text-[13px] text-text-dim">No conversations yet.</p>}
      <ul className="space-y-0.5">
        {conversations.data?.map((c) => (
          <li key={c.id} className={cn("group flex items-center gap-1 rounded-item pl-3", c.id === activeId ? "bg-surface-2" : "hover:bg-surface-2")}>
            <Link href={`/repos/${repoId}/c/${c.id}`} className="min-w-0 flex-1 truncate py-2 text-[14px] text-text-2" aria-current={c.id === activeId ? "page" : undefined}>
              {c.title}
            </Link>
            <span className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <ConfirmButton
                label="Delete conversation"
                confirmLabel="Delete?"
                onConfirm={() => del.mutate(c.id, { onSuccess: () => c.id === activeId && router.push(`/repos/${repoId}`) })}
              >
                <Trash2 />
              </ConfirmButton>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
