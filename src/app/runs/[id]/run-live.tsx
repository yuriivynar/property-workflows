"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const TABLES = ["run_events", "run_tasks", "run_fields"] as const;

/**
 * Живі оновлення сторінки запуску (UI v3, рішення власника 2026-11-26, ADR 0012): підписка Supabase Realtime
 * (postgres_changes) на події, задачі й поля цього запуску; діє RLS того, хто дивиться, тож чужого він не отримає.
 * Зміна від колеги — router.refresh() (сервер малює сторінку заново) і «Live · updated just now». Без Realtime (мережа,
 * CSP) сторінка просто лишається такою, як є.
 */
export function RunLive({ runId }: { runId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [updated, setUpdated] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`run:${runId}`);
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `run_id=eq.${runId}` }, () => {
        setUpdated(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setUpdated(false), 60_000);
        startTransition(() => router.refresh());
      });
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [router, runId]);

  return (
    <p
      aria-live="polite"
      data-testid="run-live"
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground"
    >
      <span aria-hidden="true" className={cn("size-2 rounded-full bg-muted-foreground", updated && "animate-pulse")} />
      {updated ? "Live · updated just now" : "Live"}
    </p>
  );
}
