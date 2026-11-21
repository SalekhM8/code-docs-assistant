"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddRepo } from "@/lib/queries";

export function AddRepoForm() {
  const [url, setUrl] = useState("");
  const add = useAddRepo();
  const router = useRouter();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    add.mutate(url.trim(), {
      onSuccess: (repo) => {
        setUrl("");
        router.push(`/repos/${repo.id}`);
      },
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2" aria-label="Add a repo">
      <label htmlFor="repo-url" className="text-[12.5px] font-semibold text-text-2">
        Add a public GitHub repo
      </label>
      <div className="flex gap-2">
        <Input
          id="repo-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          aria-invalid={add.isError}
          aria-describedby={add.isError ? "repo-url-error" : undefined}
          className="glass glass-field h-10 rounded-full px-4 text-[14px] shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="icon" className="bead size-10 shrink-0" disabled={add.isPending || !url.trim()} aria-label="Add repo">
          <Plus />
        </Button>
      </div>
      {add.isError && (
        <p id="repo-url-error" role="alert" className="text-[13px] leading-snug text-red-text">
          {add.error.message}
        </p>
      )}
    </form>
  );
}
