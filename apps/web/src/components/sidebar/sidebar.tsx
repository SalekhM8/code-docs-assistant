"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AddRepoForm } from "./add-repo-form";
import { ConversationList } from "./conversation-list";
import { RepoList } from "./repo-list";

export function Sidebar() {
  const params = useParams<{ repoId?: string; conversationId?: string }>();
  return (
    <nav className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto bg-surface px-4 py-5" aria-label="Repos and conversations">
      <Link href="/" className="block rounded-sm">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-eyebrow">Code docs</span>
        <span className="block font-serif text-[22px] font-light leading-tight tracking-[-0.02em]">
          Ask the code<span className="text-mark">.</span>
        </span>
      </Link>
      <AddRepoForm />
      <section aria-label="Repos" className="space-y-2">
        <h2 className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-eyebrow">Repos</h2>
        <RepoList activeRepoId={params.repoId} />
      </section>
      {params.repoId && <ConversationList repoId={params.repoId} activeId={params.conversationId} />}
    </nav>
  );
}
