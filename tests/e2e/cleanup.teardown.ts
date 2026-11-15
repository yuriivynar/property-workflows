// Прибирання після прогону (teardown проєкту setup): видаляє всіх uat-*@example.test, навіть залишки обірваних
// прогонів, і падає, якщо хоч один лишився. Підсумок — у test-results/uat-cleanup.json (його читає звіт UAT).
// Без SUPABASE_SECRET_KEY (прогін лише AC, що нічого не пишуть: --grep-invert '@writes') прибирати нічого — тесту немає.
import { writeFileSync } from "node:fs";
import { expect, test as teardown } from "@playwright/test";
import { deleteUatTemplates, deleteUatUsers, deletedThisRun, hasAdminKey } from "./support/admin";

if (hasAdminKey()) {
  teardown("прибирання: синтетичні uat-*@example.test", async () => {
    // Спершу залишки синтетичних шаблонів uat-* (Cast.template), якщо тест обірвався до dispose. Помилку запам'ятовуємо,
    // а не кидаємо одразу: користувачів прибираємо за будь-якого результату, потім тест падає з тим самим повідомленням.
    let templatesLeft: string[] = [];
    let templatesError: unknown = null;
    try {
      await deleteUatTemplates();
      templatesLeft = await deleteUatTemplates();
    } catch (error) {
      templatesError = error;
    }
    const result = await deleteUatUsers();
    writeFileSync(
      "test-results/uat-cleanup.json",
      // deleted — усе, що прибрав цей прогін: afterAll специфікацій і цей teardown.
      JSON.stringify({ at: new Date().toISOString(), ...result, deleted: deletedThisRun() }, null, 2),
    );
    expect(result.remaining, "лишились синтетичні користувачі").toEqual([]);
    expect(result.leftoverRequests, "лишились заявки синтетичних користувачів").toBe(0);
    expect(templatesError, "помилка прибирання синтетичних шаблонів").toBeNull();
    expect(templatesLeft, "лишились синтетичні шаблони").toEqual([]);
  });
}
