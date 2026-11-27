// Суддя живого eval — інша родина, ніж модель, що відповіла (порада викладача WS10; ADR 0013; поза вимогами PM —
// без AC ID): відповідь резервної nemotron раніше оцінювала сама nemotron.
import { describe, expect, it } from "vitest";
import { JUDGE_FALLBACK_MODEL, JUDGE_MODEL, judgeModelFor, PRODUCT_MODELS } from "./models";

describe("Суддя eval: інша родина, ніж відповідь", () => {
  it("відповідь Gemma (основна) — суддя nemotron", () => {
    expect(judgeModelFor(PRODUCT_MODELS[0])).toBe(JUDGE_MODEL);
    expect(judgeModelFor(PRODUCT_MODELS[1])).toBe(JUDGE_MODEL);
  });

  it("відповідь резервної nemotron — суддя Gemma, а не та сама модель", () => {
    expect(judgeModelFor(PRODUCT_MODELS[2])).toBe(JUDGE_FALLBACK_MODEL);
    expect(judgeModelFor(PRODUCT_MODELS[2]).split("/")[0]).not.toBe(PRODUCT_MODELS[2].split("/")[0]);
  });

  it("усі моделі ланцюжка й суддя — лише :free", () => {
    for (const id of [...PRODUCT_MODELS, JUDGE_MODEL, JUDGE_FALLBACK_MODEL]) expect(id.endsWith(":free")).toBe(true);
  });
});
