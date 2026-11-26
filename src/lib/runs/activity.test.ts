// Стрічка Activity (рішення власника 2026-11-26, ADR 0012; поза вимогами PM — без AC ID).
import { describe, expect, it } from "vitest";
import { activityText, type RunEvent } from "./activity";

const context = {
  viewerId: "me",
  emails: new Map<string, string | null>([["v", "vendor@example.test"]]),
  taskNames: new Map([["t1", "Fix the leak"]]),
  fieldNames: new Map([["f1", "Urgency"]]),
  templateName: "Repair",
  caseName: "Apartment 7, leak",
};
const event = (kind: string, extra: Partial<RunEvent> = {}): RunEvent => ({
  id: 1, kind, actor_id: "me", task_id: null, field_id: null, answer: null, created_at: "2026-11-26T08:40:00Z", ...extra,
});

describe("Activity: текст подій", () => {
  it("себе — «You», інших — лише email, невідомого — «Someone»", () => {
    expect(activityText(event("launched"), context)).toBe("You launched Repair for Apartment 7, leak");
    expect(activityText(event("task_done", { actor_id: "v", task_id: "t1" }), context)).toBe(
      "vendor@example.test marked Fix the leak as done",
    );
    expect(activityText(event("task_done", { actor_id: null, task_id: "x" }), context)).toBe("Someone marked a task as done");
  });

  it("відповідь — з великої літери, як в інтерфейсі; без відповіді — «cleared»", () => {
    expect(activityText(event("answer_set", { field_id: "f1", answer: "not urgent" }), context)).toBe("You set Urgency to Not urgent");
    expect(activityText(event("answer_set", { field_id: "f1" }), context)).toBe("You cleared Urgency");
    expect(activityText(event("other"), context)).toBe("You changed the run");
  });
});
