"use client";

import { Fragment, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TEMPLATE_MESSAGES } from "@/lib/templates/domain";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export interface TemplateItem {
  id: string;
  name: string;
  /** Картка, намальована на сервері (TemplateCard). */
  card: React.ReactNode;
}

/** Шаблони, назва яких містить пошуковий текст (без урахування регістру й пробілів на краях). */
export function matchTemplates<T extends { name: string }>(items: readonly T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  return needle ? items.filter((item) => item.name.toLowerCase().includes(needle)) : [...items];
}

/**
 * Пошук шаблонів за назвою (рішення власника 2026-11-26, ADR 0012): картки фільтруються під час набору, із затримкою,
 * у браузері — без запиту до сервера. Поле — у шапці, де раніше стояла форма створення (її плутали з пошуком).
 */
export function TemplatesBrowser({
  heading,
  action,
  items,
}: {
  heading: React.ReactNode;
  action: React.ReactNode;
  items: readonly TemplateItem[];
}) {
  const [text, setText] = useState("");
  const query = useDebouncedValue(text);
  const shown = matchTemplates(items, query);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {heading}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div role="search" className="relative">
            <label htmlFor="templates-search" className="sr-only">
              {TEMPLATE_MESSAGES.searchTemplates}
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="templates-search"
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={TEMPLATE_MESSAGES.searchTemplates}
              aria-controls="templates-list"
              className="h-11 pl-9 sm:h-10 sm:w-64"
            />
          </div>
          {action}
        </div>
      </div>
      {shown.length > 0 ? (
        <ul id="templates-list" className="grid gap-4 sm:grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]">
          {shown.map((item) => (
            <Fragment key={item.id}>{item.card}</Fragment>
          ))}
        </ul>
      ) : (
        <div id="templates-list" role="status" className="flex flex-col gap-1 rounded-xl border border-dashed border-border px-4 py-6 text-sm">
          <p className="font-medium">{TEMPLATE_MESSAGES.noTemplatesMatch(query.trim())}</p>
          <p className="text-muted-foreground">{TEMPLATE_MESSAGES.tryAnotherName}</p>
        </div>
      )}
    </>
  );
}
