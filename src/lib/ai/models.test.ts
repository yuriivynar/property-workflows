// Суддя живого eval — інша родина, ніж модель, що відповіла (порада викладача WS10; ADR 0013; поза вимогами PM —
// без AC ID): відповідь резервної nemotron раніше оцінювала сама nemotron.
import { describe, expect, it } from "vitest";
import { JUDGE_CANDIDATES, JUDGE_FALLBACK_MODEL, JUDGE_MODEL, judgeModelFor, judgeModelsFor, PRODUCT_MODELS } from "./models";

describe("Суддя eval: інша родина, ніж відповідь", () => {
  it("відповідь Gemma (основна) — суддя nemotron", () => {
    expect(judgeModelFor(PRODUCT_MODELS[0])).toBe(JUDGE_MODEL);
    expect(judgeModelFor(PRODUCT_MODELS[1])).toBe(JUDGE_MODEL);
  });

  it("відповідь резервної nemotron — суддя Gemma, а не та сама модель", () => {
    expect(judgeModelFor(PRODUCT_MODELS[2])).toBe(JUDGE_FALLBACK_MODEL);
    expect(judgeModelFor(PRODUCT_MODELS[2]).split("/")[0]).not.toBe(PRODUCT_MODELS[2].split("/")[0]);
  });

  it("ланцюжок суддів — лише інші родини, ніж відповідь", () => {
    expect(judgeModelsFor(PRODUCT_MODELS[2]).some((id) => id.startsWith("nvidia/"))).toBe(false);
    expect(judgeModelsFor(PRODUCT_MODELS[0]).some((id) => id.startsWith("google/"))).toBe(false);
    expect(judgeModelsFor(PRODUCT_MODELS[0]).length).toBeGreaterThan(1);
  });

  it("усі моделі ланцюжка й судді — лише :free", () => {
    for (const id of [...PRODUCT_MODELS, ...JUDGE_CANDIDATES, JUDGE_FALLBACK_MODEL]) expect(id.endsWith(":free")).toBe(true);
  });
});
