"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { answerLabel } from "@/lib/runs/domain";
import { cn } from "@/lib/utils";
import { setRunFieldAnswer } from "./actions";

export interface FieldOption {
  value: string;
  /** Рядок під відповіддю: що вона змінює у запуску («Adds "Send an emergency plumber" to Works»). */
  effect: string;
}

/** Крапка відповіді (полотно UI v3): без відповіді — пунктирне кільце; перша відповідь — червона, решта — синя. */
export function AnswerDot({ index }: { index: number | null }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        index === null && "border border-dashed border-input",
        index === 0 && "bg-destructive",
        index !== null && index > 0 && "bg-fill-progress",
      )}
    />
  );
}

/**
 * Відповідь на поле запуску — меню з крапкою й описом ефекту кожної відповіді (варіант «detail», рішення власника
 * 2026-11-26; взято з полотна UI v3). Лише менеджеру запуску й адміністратору (AC-LOGIC-02, AC-LOGIC-05); вибір
 * надсилає Server Action setRunFieldAnswer, відмову сторінка показує дослівним текстом AC-LOGIC-05.
 */
export function UrgencyMenu({
  runId,
  fieldId,
  fieldName,
  answer,
  options,
  trigger = "value",
}: {
  runId: string;
  fieldId: string;
  fieldName: string;
  answer: string | null;
  options: FieldOption[];
  /** «value» — кнопка зі значенням у картці деталей; «set» — «Set Urgency» у рядку-«привиді». */
  trigger?: "value" | "set";
}) {
  const [pending, startTransition] = useTransition();
  const selected = options.findIndex((option) => option.value === answer);

  function choose(value: string) {
    if (value === answer) return;
    const data = new FormData();
    data.set("run_id", runId);
    data.set("field_id", fieldId);
    data.set("answer", value);
    startTransition(() => setRunFieldAnswer(data));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          trigger === "set" ? (
            <Button variant="outline" size="sm" aria-busy={pending || undefined} />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-11 justify-start gap-2 px-2 font-medium sm:h-8"
              aria-label={`${fieldName}: ${answer ? answerLabel(answer) : "No answer"}`}
              aria-busy={pending || undefined}
              data-testid="field-answer"
            />
          )
        }
      >
        {trigger === "set" ? (
          `Set ${fieldName}`
        ) : (
          <>
            <AnswerDot index={selected >= 0 ? selected : null} />
            <span>{answer ? answerLabel(answer) : "No answer"}</span>
            <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuRadioGroup value={answer ?? ""} onValueChange={(value) => choose(String(value))}>
          <DropdownMenuLabel>{fieldName}</DropdownMenuLabel>
          {options.map((option, index) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="items-start py-2">
              <AnswerDot index={index} />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{answerLabel(option.value)}</span>
                <span className="text-sm text-muted-foreground">{option.effect}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
