// Перевірка назви випадку у формі запуску і тексти повідомлень (openspec/specs/run-launch).
// Те саме правило в базі — tests/db/run-launch.test.ts.
import { describe, expect, it } from "vitest";
import {
  canMarkTask,
  errorCodeFrom,
  formatProgress,
  formatYourTasks,
  groupBySection,
  isUuid,
  messageForError,
  needsConfirmation,
  requiredLabel,
  staffLabel,
  taskBelongsToRun,
  validateCaseName,
  runsListState,
  vendorRunNotice,
  errorParam,
} from "./domain";
import { LABELS, MESSAGES } from "./messages";

describe("Назва випадку", () => {
  it("AC-RUN-03: порожня назва або лише пробіли — запуску немає, повідомлення «Enter a case name»", () => {
    for (const raw of ["", "   ", undefined, null]) {
      const check = validateCaseName(raw);
      expect(check).toEqual({ ok: false, code: "CASE_NAME_REQUIRED" });
      expect(messageForError(check.ok ? undefined : check.code)).toBe("Enter a case name");
    }
  });

  it("AC-RUN-07: 101 символ — повідомлення «Case name must be at most 100 characters»; 100 — дозволено", () => {
    const tooLong = validateCaseName("A".repeat(101));
    expect(tooLong).toEqual({ ok: false, code: "CASE_NAME_TOO_LONG" });
    expect(messageForError(tooLong.ok ? undefined : tooLong.code)).toBe("Case name must be at most 100 characters");

    expect(validateCaseName("A".repeat(100))).toEqual({ ok: true, caseName: "A".repeat(100) });
  });

  it("AC-RUN-07: довжина — у символах, а не в одиницях UTF-16 (кирилиця й емодзі)", () => {
    expect(validateCaseName("Квартира ".repeat(11).slice(0, 100)).ok).toBe(true);
    expect(validateCaseName("🏠".repeat(100)).ok).toBe(true);
    expect(validateCaseName("🏠".repeat(101))).toEqual({ ok: false, code: "CASE_NAME_TOO_LONG" });
  });

  it("AC-RUN-03: пробіли на краях обрізаються, назва зберігається без них", () => {
    expect(validateCaseName("  Apartment 12, move-in  ")).toEqual({ ok: true, caseName: "Apartment 12, move-in" });
  });
});

describe("Помилки функцій бази", () => {
  it("AC-RUN-03: код CASE_NAME_REQUIRED з помилки Supabase дає «Enter a case name»", () => {
    expect(errorCodeFrom("CASE_NAME_REQUIRED")).toBe("CASE_NAME_REQUIRED");
    expect(messageForError(errorCodeFrom("CASE_NAME_REQUIRED"))).toBe("Enter a case name");
  });

  it("AC-RUN-07: код CASE_NAME_TOO_LONG з помилки Supabase дає текст AC-RUN-07", () => {
    expect(messageForError(errorCodeFrom("CASE_NAME_TOO_LONG"))).toBe("Case name must be at most 100 characters");
  });

  it("AC-RUN-04: невідомий код — загальне повідомлення, а не сирий текст бази", () => {
    expect(errorCodeFrom("duplicate key value violates unique constraint")).toBeUndefined();
    expect(messageForError(undefined)).toBe("Something went wrong. Try again.");
    expect(messageForError("INVALID_ASSIGNEE")).toBe("An assignee must be a manager, an administrator or a vendor");
  });
});

describe("Код помилки з адреси сторінки", () => {
  it("AC-RUN-03: службові ключі (__proto__, constructor, toString) — не коди помилок, а загальне повідомлення-рядок", () => {
    for (const key of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(errorCodeFrom(key)).toBeUndefined();
      expect(messageForError(key)).toBe("Something went wrong. Try again.");
    }
  });
});

describe("Позначка задачі", () => {
  const base = { runManagerId: "manager-a", assigneeId: "manager-b", status: "to_do" };

  it("AC-TASK-01: виконавець бачить кнопку позначки своєї задачі", () => {
    expect(canMarkTask({ ...base, userId: "manager-b", role: "manager" })).toBe(true);
  });

  it("AC-TASK-02: менеджер запуску бачить кнопку на задачі іншого виконавця", () => {
    expect(canMarkTask({ ...base, userId: "manager-a", role: "manager" })).toBe(true);
  });

  it("AC-TASK-07: адміністратор бачить кнопку на будь-якій задачі", () => {
    expect(canMarkTask({ ...base, userId: "admin", role: "admin" })).toBe(true);
  });

  it("AC-TASK-03: сторонній менеджер кнопки не бачить; відмова бази NOT_ALLOWED дає текст AC-TASK-03 дослівно", () => {
    expect(canMarkTask({ ...base, userId: "manager-c", role: "manager" })).toBe(false);
    expect(errorCodeFrom("NOT_ALLOWED")).toBe("NOT_ALLOWED");
    expect(messageForError("NOT_ALLOWED")).toBe(
      "Only the task's assignee, the run manager, or an administrator can mark a task as done",
    );
  });

  it("AC-TASK-01: на задачі «done» кнопки немає — позначка остаточна", () => {
    expect(canMarkTask({ ...base, status: "done", userId: "manager-b", role: "manager" })).toBe(false);
  });
});

describe("Прогрес", () => {
  it("AC-TASK-05: 2 з 5 задач «done» — «2 of 5 done»", () => {
    expect(formatProgress(2, 5)).toBe("2 of 5 done");
  });

  it("AC-TASK-09: той самий запис прогресу в рядку списку запусків", () => {
    expect(formatProgress(2, 5)).toBe("2 of 5 done");
    expect(formatProgress(5, 5)).toBe("5 of 5 done");
  });
});

describe("Ідентифікатори з форми", () => {
  it("AC-TASK-03: id задачі не у форматі UUID відкидається до запиту до бази", () => {
    expect(isUuid("10000000-0000-4000-8000-000000000101")).toBe(true);
    for (const value of ["", "abc", "1; drop table runs", "10000000-0000-4000-8000-00000000010", null, undefined]) {
      expect(isUuid(value)).toBe(false);
    }
  });
});

describe("Уточнення PM: підтвердження, email, сторінка запуску", () => {
  const run = [
    { id: "t1", is_required: true, status: "done" },
    { id: "t2", is_required: true, status: "done" },
    { id: "t3", is_required: true, status: "to_do" },
    { id: "t4", is_required: false, status: "to_do" },
    { id: "t5", is_required: false, status: "to_do" },
  ];
  const early = [
    { id: "t1", is_required: true, status: "to_do" },
    { id: "t2", is_required: true, status: "to_do" },
    { id: "t3", is_required: false, status: "to_do" },
  ];

  it("AC-TASK-01: задачу, яка не є останньою обов'язковою, позначають без підтвердження", () => {
    expect(needsConfirmation(early, "t1")).toBe(false);
    expect(needsConfirmation(run, "t4")).toBe(false);
  });

  it("AC-TASK-02: менеджер запуску позначає не останню обов'язкову задачу без підтвердження", () => {
    expect(needsConfirmation(early, "t2")).toBe(false);
  });

  it("AC-TASK-07: адміністратор позначає не останню обов'язкову задачу без підтвердження", () => {
    expect(needsConfirmation(early, "t1")).toBe(false);
  });

  it("AC-TASK-04: третю (останню) обов'язкову задачу позначають лише з підтвердженням", () => {
    expect(needsConfirmation(run, "t3")).toBe(true);
  });

  it("AC-TASK-16: підтвердження з назвою задачі й «This cannot be undone» — саме для останньої обов'язкової", () => {
    expect(needsConfirmation(run, "t3")).toBe(true);
    expect(LABELS.confirmMarkAsDone("Hand over the keys")).toBe(
      "Mark «Hand over the keys» as done? This cannot be undone.",
    );
  });

  it("AC-RUN-10: у виборі виконавця підпис колеги — лише email", () => {
    expect(staffLabel({ email: "manager.b@example.test" })).toBe("manager.b@example.test");
  });

  it("AC-TASK-11: біля задачі — email виконавця, без імені", () => {
    expect(staffLabel({ email: "admin@example.test" })).toBe("admin@example.test");
  });

  it("AC-TASK-10: стороннім показуємо «Run not found»", () => {
    expect(MESSAGES.runNotFound).toBe("Run not found");
  });

  it("AC-TASK-15: позначки «required» і «optional»", () => {
    expect([requiredLabel(true), requiredLabel(false)]).toEqual(["required", "optional"]);
  });

  it("AC-TASK-18: співвиконавець C бачить позначку на своїй задачі, а на задачі B — ні", () => {
    const base = { runManagerId: "manager-a", status: "to_do", userId: "manager-c", role: "manager" };
    expect(canMarkTask({ ...base, assigneeId: "manager-c" })).toBe(true);
    expect(canMarkTask({ ...base, assigneeId: "manager-b" })).toBe(false);
  });
});

describe("Задача й запуск з форми", () => {
  it("AC-TASK-03: задачу з іншого запуску або невидиму задачу дія не позначає", () => {
    expect(taskBelongsToRun({ run_id: "run-1" }, "run-1")).toBe(true);
    expect(taskBelongsToRun({ run_id: "run-2" }, "run-1")).toBe(false);
    expect(taskBelongsToRun(null, "run-1")).toBe(false);
  });
});

describe("Вендор: список і сторінка запуску", () => {
  it("AC-VENDOR-07: відмова позначки чужої задачі на своєму запуску — вендор бачить текст AC-TASK-03", () => {
    expect(vendorRunNotice(true, errorCodeFrom("NOT_ALLOWED"))).toBe(
      "Only the task's assignee, the run manager, or an administrator can mark a task as done",
    );
    // Без коду помилки сторінка нічого не показує.
    expect(vendorRunNotice(true, undefined)).toBeUndefined();
  });

  it("AC-VENDOR-15: відмова позначки на запуску без задач вендора — лише «Run not found», без тексту відмови", () => {
    expect(vendorRunNotice(false, errorParam("NOT_ALLOWED"))).toBeUndefined();
    // Код з адреси — лише рядок: масив (?error=a&error=b) не дає повідомлення.
    expect(errorParam(["NOT_ALLOWED", "x"])).toBeUndefined();
    expect(MESSAGES.runNotFound).toBe("Run not found");
  });

  it("AC-VENDOR-03: рядок запуску вендора — «Your tasks: 0 of 2 done» (лише його задачі в запуску)", () => {
    expect(formatYourTasks(0, 2)).toBe("Your tasks: 0 of 2 done");
  });

  it("AC-VENDOR-05: після позначки своєї задачі вендор бачить «Your tasks: 1 of 2 done»", () => {
    expect(formatYourTasks(1, 2)).toBe("Your tasks: 1 of 2 done");
  });

  it("AC-VENDOR-04: задачі вендора — за розділами в порядку запуску, розділів без його задач немає", () => {
    const tasks = [
      { id: "t4", section_name: "Move-in day", section_position: 2 },
      { id: "t3", section_name: "Before move-in", section_position: 1 },
    ];
    expect(groupBySection(tasks)).toEqual([
      { name: "Before move-in", position: 1, tasks: [tasks[1]] },
      { name: "Move-in day", position: 2, tasks: [tasks[0]] },
    ]);
    expect(groupBySection([])).toEqual([]);
  });

  it("AC-VENDOR-10: вендор без задач — «No tasks assigned to you yet.» замість порожньої таблиці", () => {
    expect(runsListState([])).toBe("empty");
    expect(runsListState(null)).toBe("empty");
    expect(MESSAGES.noVendorTasks).toBe("No tasks assigned to you yet.");
  });
});
