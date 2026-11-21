"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** One clear message when the api or its database is down, instead of every panel failing on its own. */
export function ApiStatus() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 15_000, retry: false });
  if (health.isPending || (health.isSuccess && health.data.status === "ok")) return null;
  const message = health.isError
    ? "Cannot reach the api. Start it with `docker compose up` (or `pnpm dev`), then this page will reconnect."
    : "The api is up but cannot reach its database. Check that Postgres is running.";
  return (
    <div role="alert" className="border-b-[1.5px] border-red bg-red-tint px-4 py-2 text-[13px] text-red-text">
      {message}
    </div>
  );
}
