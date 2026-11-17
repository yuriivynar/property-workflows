// Паритет правил «хто може»: той самий перебір (роль × чи менеджер запуску × чи виконавець) проходить і через
// TypeScript-функції, які вирішують, що показати в інтерфейсі, і через функції бази, які вирішують насправді.
// Розбіжність = кнопка, що завжди повертає відмову, або (гірше) правило, яке інтерфейс обіцяє, а база не дає.
// Рев'ю безпеки 2026-11-17, знахідка 6. Правила: private.mark_task_done (vendor_role.sql) і
// private.can_manage_run_documents (run_document_values.sql).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canUseDocumentBlock } from "@/lib/documents/form";
import { canMarkTask } from "@/lib/runs/domain";
import { createTestDb, type TestDb } from "./supabase-pglite";

const TENANT_MOVE_IN = "10000000-0000-4000-8000-000000000001";
// Користувач із кожною роллю; «інший» — будь-хто з решти, хто не є суб'єктом перевірки.
const SUBJECTS = [
  { role: "admin", email: "admin@example.test" },
  { role: "manager", email: "manager.a@example.test" },
  { role: "vendor", email: "vendor@example.test" },
] as const;

let t: TestDb;
let RUN: string;
let TASK: string;
const idOf = (email: string) => t.users[email];

/** Хтось інший, не суб'єкт: ні менеджер запуску, ні виконавець. */
const someoneElse = (subjectId: string) => Object.values(t.users).find((id) => id !== subjectId)!;

beforeAll(async () => {
  t = await createTestDb();
  const [first] = await t.asService<{ id: string }>(
    `select tt.id from public.template_tasks as tt join public.template_sections as s on s.id = tt.section_id
     where tt.template_id = $1 order by s.position, tt.position limit 1`,
    [TENANT_MOVE_IN],
  );
  const [row] = await t.asUser<{ id: string }>(idOf("manager.b@example.test"), "select public.launch_run($1, $2, $3) as id", [
    TENANT_MOVE_IN,
    "Apartment 12, rule parity",
    { [first.id]: idOf("vendor@example.test") },
  ]);
  RUN = row.id;
  [{ id: TASK }] = await t.asService<{ id: string }>("select id from public.run_tasks where run_id = $1 limit 1", [RUN]);
}, 60_000);

afterAll(async () => {
  await t.db.close();
});

/** Ставить запуск у стан клітинки матриці: хто менеджер запуску і хто виконавець задачі; задача «to do». */
async function arrange(subjectId: string, isRunManager: boolean, isAssignee: boolean) {
  const other = someoneElse(subjectId);
  await t.asService("update public.runs set run_manager_id = $2, status = 'in_progress' where id = $1", [
    RUN,
    isRunManager ? subjectId : other,
  ]);
  await t.asService("update public.run_tasks set assignee_id = $2, status = 'to_do' where id = $1", [TASK, isAssignee ? subjectId : other]);
}

describe("паритет TypeScript і бази: позначка задачі", () => {
  for (const { role, email } of SUBJECTS) {
    for (const isRunManager of [false, true]) {
      for (const isAssignee of [false, true]) {
        const cell = `${role}, ${isRunManager ? "менеджер запуску" : "не менеджер запуску"}, ${isAssignee ? "виконавець" : "не виконавець"}`;
        it(`AC-TASK-03: ${cell} — кнопка й база дають однакову відповідь`, async () => {
          const subject = idOf(email);
          await arrange(subject, isRunManager, isAssignee);

          const [{ run_manager_id }] = await t.asService<{ run_manager_id: string }>(
            "select run_manager_id from public.runs where id = $1",
            [RUN],
          );
          const [{ assignee_id }] = await t.asService<{ assignee_id: string }>(
            "select assignee_id from public.run_tasks where id = $1",
            [TASK],
          );
          const shown = canMarkTask({ userId: subject, role, runManagerId: run_manager_id, assigneeId: assignee_id, status: "to_do" });

          const allowed = await t
            .asUser(subject, "select public.mark_task_done($1, true)", [TASK])
            .then(
              () => true,
              (e: Error) => {
                expect(e.message).toMatch(/NOT_ALLOWED/);
                return false;
              },
            );
          expect(shown).toBe(allowed);
        });
      }
    }
  }
});

describe("паритет TypeScript і бази: блок «Parse a document»", () => {
  for (const { role, email } of SUBJECTS) {
    for (const isRunManager of [false, true]) {
      it(`AC-DOCAI-16: ${role}, ${isRunManager ? "менеджер запуску" : "не менеджер запуску"} — блок і RLS-хелпер дають однакову відповідь`, async () => {
        const subject = idOf(email);
        await arrange(subject, isRunManager, false);
        const [{ run_manager_id }] = await t.asService<{ run_manager_id: string }>(
          "select run_manager_id from public.runs where id = $1",
          [RUN],
        );
        const shown = canUseDocumentBlock({ role, userId: subject }, run_manager_id);
        const [row] = await t.asUser<{ allowed: boolean }>(subject, "select private.can_manage_run_documents($1) as allowed", [RUN]);
        expect(shown).toBe(row.allowed);
      });
    }
  }
});
