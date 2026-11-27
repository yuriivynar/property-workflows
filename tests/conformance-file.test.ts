// Матриця відповідності — цілий файл (знахідка незалежного рев'ю 2026-11-27): PR #128 випадково замінив заголовок
// рядком «undefined…» з уламками рядків AC-LOGIC, а ac:coverage рахує лише рядки таблиці й цього не помітив.
// Поза вимогами PM — без AC ID.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const matrix = readFileSync(new URL("../docs/conformance.md", import.meta.url), "utf8");
const lines = matrix.split("\n");

describe("docs/conformance.md", () => {
  it("починається із заголовка матриці", () => {
    expect(lines[0]).toBe("# Матриця відповідності (AC → код → тест → статус)");
  });

  it("жоден рядок не містить «undefined» чи «[object Object]» — слідів зламаного генератора", () => {
    expect(lines.filter((line) => /\bundefined\b|\[object Object\]/.test(line))).toEqual([]);
  });

  it("кожен рядок AC — один рядок таблиці з п'ятьма клітинками", () => {
    const rows = lines.filter((line) => /^\| AC-[A-Z]+-\d+ /.test(line));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.split(" | ").length).toBe(5);
  });
});
