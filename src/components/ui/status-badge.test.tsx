import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusBadge, STATUSES } from "./status-badge";

describe("Дизайн-система: статуси", () => {
  it("AC-DSYS-01: «in progress» — синій, «completed» — зелений; те саме слово й колір на кожній сторінці, слово поруч із кольором", () => {
    // Список запусків і сторінка запуску обидві рендерять StatusBadge зі статусом із бази — одна мапа на весь застосунок.
    const inProgress = renderToStaticMarkup(<StatusBadge status="in_progress" />);
    const completed = renderToStaticMarkup(<StatusBadge status="completed" />);

    expect(inProgress).toContain(">in progress<");
    expect(inProgress).toContain("bg-status-in-progress text-status-in-progress-foreground");
    expect(completed).toContain(">completed<");
    expect(completed).toContain("bg-status-done text-status-done-foreground");

    // Колір ніколи не без слова: у кожного статусу мапи є непорожній текст.
    for (const { label } of Object.values(STATUSES)) expect(label.trim()).not.toBe("");
    // Той самий статус — та сама розмітка при повторному рендері (на іншій сторінці).
    expect(renderToStaticMarkup(<StatusBadge status="completed" />)).toBe(completed);
  });

  it("AC-DSYS-01: «done» задачі й «completed» запуску — один зелений токен, «to do» — нейтральний сірий", () => {
    expect(STATUSES.done.className).toBe(STATUSES.completed.className);
    expect(STATUSES.to_do.className).toBe("bg-status-todo text-status-todo-foreground");
    expect(STATUSES.unpublished.label).toBe("Unpublished changes");
  });
});
