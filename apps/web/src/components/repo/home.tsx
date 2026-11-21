"use client";

import { Eyebrow, Headline } from "@/components/eyebrow";
import { Orb } from "@/components/orb";

export function Home() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md space-y-4 rounded-card bg-surface p-8 shadow-card">
        <Orb state="idle" />
        <Eyebrow>Code documentation assistant</Eyebrow>
        <Headline>Ask a repo how it works</Headline>
        <p className="text-[15px] leading-relaxed text-text-2">
          Pick a repo on the left, or paste a public GitHub URL to index one. Answers cite the exact files and lines they come from, and you can open each
          citation beside the chat.
        </p>
      </div>
    </div>
  );
}
