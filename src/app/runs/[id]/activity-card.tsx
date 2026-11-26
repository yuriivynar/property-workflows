import { Card } from "@/components/ui/card";
import { activityText, type ActivityContext, type RunEvent } from "@/lib/runs/activity";
import { formatVersionDate } from "@/lib/templates/domain";

/**
 * Стрічка Activity запуску (UI v3, рішення власника 2026-11-26, ADR 0012): останні 10 подій, найновіші вгорі — хто
 * (себе — «You», інших — лише email), що й коли (DD.MM.YYYY HH:MM за Києвом). Вендору стрічки не показуємо (RLS теж).
 */
export function ActivityCard({ events, context }: { events: readonly RunEvent[]; context: ActivityContext }) {
  return (
    <section aria-labelledby="activity" className="flex flex-col gap-2">
      <h2 id="activity" className="text-base font-semibold">
        Activity
      </h2>
      <Card className="gap-0 py-0">
        {events.length === 0 ? (
          <p className="px-4 py-3.5 text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol aria-live="polite" className="flex flex-col divide-y divide-border">
            {events.map((event) => (
              <li key={event.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span className="[overflow-wrap:anywhere]">{activityText(event, context)}</span>
                <time dateTime={event.created_at} className="shrink-0 tabular-nums text-muted-foreground">
                  {formatVersionDate(event.created_at)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </section>
  );
}
