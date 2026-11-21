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
    <div role="alert" className="absolute left-1/2 top-24 z-40 w-max max-w-[92%] -translate-x-1/2 rounded-full border-[1.5px] border-red bg-red-tint px-5 py-3 text-[13.5px] font-medium text-red-text shadow-card xl:top-20">
      {message}
    </div>
  );
}
