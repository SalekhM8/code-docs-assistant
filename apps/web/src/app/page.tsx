"use client";

import { useQuery } from "@tanstack/react-query";
import { getHealth } from "@/lib/api";

export default function Home() {
  const health = useQuery({ queryKey: ["health"], queryFn: getHealth });
  return (
    <main className="grid h-dvh grid-cols-[260px_1fr_420px]">
      <aside className="border-r p-4">Repos</aside>
      <section className="p-4">
        <h1 className="text-lg font-semibold">Code Docs Assistant</h1>
        <p data-testid="health">{health.isPending ? "Checking api…" : health.isError ? health.error.message : `api ${health.data.status}`}</p>
      </section>
      <aside className="border-l p-4">Code</aside>
    </main>
  );
}
