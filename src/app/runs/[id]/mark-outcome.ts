import { CONFIRMATION_REQUIRED } from "@/lib/runs/domain";
import type { InPlaceResult } from "./actions";

/**
 * Відповідь миттєвої позначки → що показати в рядку (сторінка запуску й «Your next tasks» на Profile): база відповіла
 * CONFIRMATION_REQUIRED — задача остання обов'язкова, а дані сторінки застаріли, тож показуємо підтвердження з назвою
 * задачі, а не помилку (AC-TASK-04, AC-TASK-16); інша відмова — дослівний текст AC у рядку (AC-TASK-03).
 */
export function outcomeOf(result: InPlaceResult): { ask: boolean; error: string | null } {
  const ask = result.code === CONFIRMATION_REQUIRED;
  return { ask, error: ask ? null : result.error };
}
