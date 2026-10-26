import type { Json } from "@/lib/supabase/database.types";

// Знімок версії шаблону (template_versions.content) — формат фіксує private.template_snapshot у міграції
// 20261026133459_template_versions.sql. Версію не змінюють: її лише показують і копіюють у запуск (AC-EDITOR-03,
// AC-EDITOR-06; openspec/changes/impl-template-versions/design.md, розділ 2).

export interface VersionTask {
  id: string;
  name: string;
  is_required: boolean;
  position: number;
}

export interface VersionSection {
  id: string;
  name: string;
  position: number;
  tasks: VersionTask[];
}

export interface VersionContent {
  sections: VersionSection[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parseTask(value: unknown): VersionTask | null {
  if (!isObject(value)) return null;
  const { id, name, is_required, position } = value;
  if (typeof id !== "string" || typeof name !== "string" || typeof is_required !== "boolean") return null;
  if (typeof position !== "number") return null;
  return { id, name, is_required, position };
}

function parseSection(value: unknown): VersionSection | null {
  if (!isObject(value)) return null;
  const { id, name, position, tasks } = value;
  if (typeof id !== "string" || typeof name !== "string" || typeof position !== "number") return null;
  if (!Array.isArray(tasks)) return null;
  const parsed = tasks.map(parseTask);
  if (parsed.some((task) => task === null)) return null;
  return { id, name, position, tasks: (parsed as VersionTask[]).sort((a, b) => a.position - b.position) };
}

/** Розбирає знімок версії; невідомий формат — порожня версія (сторінка покаже шаблон без задач, а не впаде). */
export function parseVersionContent(content: Json | null | undefined): VersionContent {
  if (!isObject(content) || !Array.isArray(content.sections)) return { sections: [] };
  const sections = content.sections.map(parseSection);
  if (sections.some((section) => section === null)) return { sections: [] };
  return { sections: (sections as VersionSection[]).sort((a, b) => a.position - b.position) };
}

/** «Template version N» на сторінці запуску (AC-EDITOR-06). */
export const templateVersionLabel = (version: number) => `Template version ${version}`;
