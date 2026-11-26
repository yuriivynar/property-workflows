import { Check, CircleAlert } from "lucide-react";
import { TEMPLATE_MESSAGES } from "@/lib/templates/domain";

/**
 * Статус автозбереження редактора — в одному фіксованому місці, у рядку збереження, що липне до верху (ADR 0012):
 * «All changes kept» або дослівно «Your last change was not kept. Try again.» (AC-EDITOR-25) з role="alert".
 */
export function AutosaveStatus({ failed }: { failed: boolean }) {
  if (failed) {
    return (
      <span role="alert" data-testid="autosave-status" className="flex items-center gap-1.5 text-destructive">
        <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
        {TEMPLATE_MESSAGES.changeNotKept}
      </span>
    );
  }
  return (
    <span data-testid="autosave-status" className="flex items-center gap-1.5">
      <Check aria-hidden="true" className="size-4 shrink-0" />
      {TEMPLATE_MESSAGES.allChangesKept}
    </span>
  );
}
