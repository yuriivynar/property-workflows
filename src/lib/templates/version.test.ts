import { describe, expect, it } from "vitest";
import { parseVersionContent, templateVersionLabel } from "./version";

describe("Знімок версії шаблону", () => {
  it("AC-EDITOR-06: сторінка запуску показує «Template version 1»", () => {
    expect(templateVersionLabel(1)).toBe("Template version 1");
  });

  it("AC-EDITOR-06: розділи й задачі знімка — за позицією; невідомий формат — порожня версія", () => {
    const content = {
      sections: [
        { id: "s2", name: "Move-in day", position: 2, tasks: [{ id: "t3", name: "Keys", is_required: true, position: 1 }] },
        {
          id: "s1",
          name: "Before move-in",
          position: 1,
          tasks: [
            { id: "t2", name: "Deposit", is_required: true, position: 2 },
            { id: "t1", name: "Lease", is_required: true, position: 1 },
          ],
        },
      ],
    };
    const parsed = parseVersionContent(content);
    expect(parsed.sections.map((s) => s.name)).toEqual(["Before move-in", "Move-in day"]);
    expect(parsed.sections[0].tasks.map((task) => task.name)).toEqual(["Lease", "Deposit"]);
    expect(parseVersionContent({ sections: [{ id: 1 }] })).toEqual({ sections: [] });
    expect(parseVersionContent(null)).toEqual({ sections: [] });
  });
});
