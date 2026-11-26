"use client";

import { useTransition } from "react";
import { Ellipsis, FolderInput, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { moveTaskToSection, removeTask } from "../../actions";

export const TASK_MENU_LABELS = {
  more: (task: string) => `More actions for «${task}»`,
  moveTo: "Move to section",
  remove: "Remove task",
} as const;

/**
 * Рідші дії задачі в редакторі — у меню «⋯» (рішення власника 2026-11-26, ADR 0012): «Move to section» з підменю
 * інших розділів (замість випадного списку й кнопки «Move» в кожному рядку) і «Remove task». Дії — ті самі Server
 * Actions, що й раніше (moveTaskToSection, removeTask): роль перевіряє дія, рядки — RLS.
 */
export function TaskActionsMenu({
  templateId,
  taskId,
  taskName,
  sectionId,
  sections,
}: {
  templateId: string;
  taskId: string;
  taskName: string;
  sectionId: string;
  sections: readonly { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const others = sections.filter((section) => section.id !== sectionId);

  function run(action: (form: FormData) => Promise<void>, extra: Record<string, string> = {}) {
    const form = new FormData();
    form.set("template_id", templateId);
    form.set("task_id", taskId);
    for (const [key, value] of Object.entries(extra)) form.set(key, value);
    startTransition(() => action(form));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={TASK_MENU_LABELS.more(taskName)}
        title="More actions"
        aria-busy={pending || undefined}
        disabled={pending}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-11 text-muted-foreground hover:text-foreground sm:size-8", pending && "opacity-60")}
      >
        <Ellipsis aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {others.length > 0 ? (
          <>
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput aria-hidden="true" />
                  {TASK_MENU_LABELS.moveTo}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  {others.map((section) => (
                    <DropdownMenuItem key={section.id} onClick={() => run(moveTaskToSection, { section_id: section.id })}>
                      <span className="truncate">{section.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={() => run(removeTask)}>
            <Trash2 aria-hidden="true" />
            {TASK_MENU_LABELS.remove}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
