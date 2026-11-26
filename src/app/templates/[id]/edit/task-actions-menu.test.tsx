// @vitest-environment jsdom
// Меню «⋯» задачі в редакторі: «Move to section» з підменю інших розділів і «Remove task» (рішення власника 2026-11-26,
// ADR 0012; поза вимогами PM — без AC ID).
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const moveTaskToSection = vi.hoisted(() => vi.fn<(form: FormData) => Promise<void>>(async () => {}));
const removeTask = vi.hoisted(() => vi.fn<(form: FormData) => Promise<void>>(async () => {}));
vi.mock("../../actions", () => ({ moveTaskToSection, removeTask }));

const { TaskActionsMenu } = await import("./task-actions-menu");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const SECTIONS = [
  { id: "s1", name: "Move-in day" },
  { id: "s2", name: "Paperwork" },
];

async function openMenu(sections = SECTIONS) {
  render(<TaskActionsMenu templateId="t1" taskId="k1" taskName="Hand over the keys" sectionId="s1" sections={sections} />);
  fireEvent.click(screen.getByRole("button", { name: "More actions for «Hand over the keys»" }));
  return within(await screen.findByRole("menu"));
}

describe("Редактор: меню дій задачі", () => {
  it("«Move to section» показує лише інші розділи; вибір переносить задачу туди", async () => {
    const menu = await openMenu();
    fireEvent.click(menu.getByRole("menuitem", { name: "Move to section" }));

    const target = await screen.findByRole("menuitem", { name: "Paperwork" });
    expect(screen.queryByRole("menuitem", { name: "Move-in day" })).toBeNull();
    fireEvent.click(target);

    await vi.waitFor(() => expect(moveTaskToSection).toHaveBeenCalledOnce());
    const form = moveTaskToSection.mock.calls[0][0];
    expect([form.get("template_id"), form.get("task_id"), form.get("section_id")]).toEqual(["t1", "k1", "s2"]);
  });

  it("«Remove task» видаляє задачу; з одним розділом пункту переносу немає", async () => {
    const menu = await openMenu([SECTIONS[0]]);
    expect(menu.queryByRole("menuitem", { name: "Move to section" })).toBeNull();

    fireEvent.click(menu.getByRole("menuitem", { name: "Remove task" }));
    await vi.waitFor(() => expect(removeTask).toHaveBeenCalledOnce());
  });
});
