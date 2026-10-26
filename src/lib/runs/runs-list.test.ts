import { describe, expect, it } from "vitest";
import { runsListState } from "./domain";
import { LABELS } from "./messages";

describe("Список запусків: порожній стан", () => {
  it("AC-DSYS-04: менеджер без запусків — «No runs yet. Launch a template to start one.» і «Launch a template», без таблиці", () => {
    expect(runsListState([])).toBe("empty");
    expect(runsListState(null)).toBe("empty");
    expect(LABELS.noRuns).toBe("No runs yet. Launch a template to start one.");
    expect(LABELS.launchTemplate).toBe("Launch a template");
    // Є хоча б один запуск — таблиця.
    expect(runsListState([{ id: "r1" }])).toBe("table");
  });
});
