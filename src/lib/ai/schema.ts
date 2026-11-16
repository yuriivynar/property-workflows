import { z } from "zod";

// Схема відповіді моделі для AI-розбору документа (openspec/specs/document-parsing, AC-DOCAI-01…10).
// Взято з koldovsky/2026-quitcode-10-ai-features-hw/materials/ai-feature/src/lib/ai/schema.ts, поля — під зріз 4.
// Три стани status:
//   ok         — документ — звернення чи кошторис, значення можна показати людині на перевірку;
//   needs_info — це звернення, але саму проблему не названо (значення = null);
//   refused    — документ не звернення і не кошторис (AC-DOCAI-07).
// Кожне поле обов'язкове, «невідоме» = null (не .optional()): значення, якого немає в документі, не вигадуємо
// (AC-DOCAI-02). Переліки — з правил solomchaak/property-workflows-spec#40.

export const CATEGORIES = [
  "plumbing",
  "electrical",
  "heating and cooling",
  "appliance",
  "structure and doors",
  "other",
] as const;
export const URGENCIES = ["urgent", "not urgent"] as const;
export const KINDS = ["request", "estimate"] as const;

export const ItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(1_000_000),
  unitPrice: z.number().nonnegative().max(100_000_000),
});
export type Item = z.infer<typeof ItemSchema>;

export const ProposalSchema = z.object({
  status: z.enum(["ok", "needs_info", "refused"]),
  kind: z.enum(KINDS).nullable(),
  phone: z.string().max(40).nullable(),
  description: z.string().max(500).nullable(),
  category: z.enum(CATEGORIES).nullable(),
  urgency: z.enum(URGENCIES).nullable(),
  items: z.array(ItemSchema).max(50),
  total: z.number().nonnegative().max(100_000_000).nullable(),
  notes: z.array(z.string().max(200)).max(5),
  twoProblems: z.boolean(),
  instructionsIgnored: z.boolean(),
});

export type Proposal = z.infer<typeof ProposalSchema>;
