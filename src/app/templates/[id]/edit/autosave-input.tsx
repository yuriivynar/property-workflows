"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";

/**
 * Поле назви в редакторі, що зберігається саме (рішення власника 2026-11-26, ADR 0012): щойно поле втратило фокус і
 * значення змінилося — надсилає свою форму (та сама дія renameTemplate / renameSection / renameTask, що й раніше
 * кнопка «Rename», якої більше немає). Enter теж надсилає (у формі одне текстове поле), Esc повертає збережене значення.
 * Набране не губиться, коли далі натискають іншу дію редактора: збереження йде першим. Помилки — як раніше: назва
 * шаблону — під полем, інші — в рядку автозбереження (AC-EDITOR-19, AC-EDITOR-25).
 */
export function AutosaveInput(props: Omit<React.ComponentProps<typeof Input>, "onBlur" | "onKeyDown">) {
  // Останнє надіслане значення: Enter, а потім втрата фокусу до відповіді сервера не надсилають те саме вдруге.
  const sent = useRef<string | null>(null);

  function save(input: HTMLInputElement) {
    if (input.value === input.defaultValue || input.value === sent.current) return;
    sent.current = input.value;
    input.form?.requestSubmit();
  }

  return (
    <Input
      {...props}
      enterKeyHint="done"
      onBlur={(event) => save(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          save(event.currentTarget);
        } else if (event.key === "Escape") {
          event.currentTarget.value = event.currentTarget.defaultValue;
          sent.current = null;
          event.currentTarget.blur();
        }
      }}
    />
  );
}
