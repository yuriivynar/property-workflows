// Стрічка Activity запуску (UI v3, рішення власника 2026-11-26, ADR 0012): текст події з журналу run_events — хто, що,
// коли, без вільного тексту. Інших людей називаємо лише email (AC-RUN-10, AC-TASK-11); себе — «You».

export interface RunEvent {
  id: number;
  kind: string;
  actor_id: string | null;
  task_id: string | null;
  field_id: string | null;
  answer: string | null;
  created_at: string;
}

export interface ActivityContext {
  viewerId: string;
  emails: Map<string, string | null>;
  taskNames: Map<string, string>;
  fieldNames: Map<string, string>;
  templateName: string;
  caseName: string;
}

const capitalized = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Хто: «You» для того, хто дивиться; інакше email; невідомий (профіль видалено) — «Someone». */
function actorOf(event: RunEvent, context: ActivityContext): string {
  if (event.actor_id && event.actor_id === context.viewerId) return "You";
  return (event.actor_id ? context.emails.get(event.actor_id) : null) ?? "Someone";
}

/** Текст події: «You launched Repair for Apartment 7, leak», «vendor@example.test marked Fix the leak as done» тощо. */
export function activityText(event: RunEvent, context: ActivityContext): string {
  const actor = actorOf(event, context);
  switch (event.kind) {
    case "launched":
      return `${actor} launched ${context.templateName} for ${context.caseName}`;
    case "task_done":
      return `${actor} marked ${context.taskNames.get(event.task_id ?? "") ?? "a task"} as done`;
    case "answer_set": {
      const field = context.fieldNames.get(event.field_id ?? "") ?? "a field";
      return event.answer ? `${actor} set ${field} to ${capitalized(event.answer)}` : `${actor} cleared ${field}`;
    }
    default:
      return `${actor} changed the run`;
  }
}
