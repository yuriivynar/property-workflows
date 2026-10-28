"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { TEMPLATE_MESSAGES } from "@/lib/templates/domain";
import { removeSection } from "../../actions";

// Видалення розділу — з підтвердженням: назва розділу й «This cannot be undone»; «Cancel» нічого не надсилає
// (AC-EDITOR-13). Лише підтверджена форма несе confirmed=true — без нього дія нічого не видаляє (AC-EDITOR-14).
// Незворотну дію підтверджують кнопкою destructive (DESIGN.md, розділ 5); зразок — mark-done-button.tsx.
export function RemoveSectionButton({
  templateId,
  sectionId,
  sectionName,
}: {
  templateId: string;
  sectionId: string;
  sectionName: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" onClick={() => setConfirming(true)}>
        {TEMPLATE_MESSAGES.removeSection}
      </Button>
    );
  }

  return (
    <form
      action={removeSection}
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={TEMPLATE_MESSAGES.confirmRemoveSectionGroup}
    >
      <input type="hidden" name="template_id" value={templateId} />
      <input type="hidden" name="section_id" value={sectionId} />
      <input type="hidden" name="confirmed" value="true" />
      <span className="text-sm">{TEMPLATE_MESSAGES.confirmRemoveSection(sectionName)}</span>
      <ConfirmButton />
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
        {TEMPLATE_MESSAGES.cancel}
      </Button>
    </form>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="sm" disabled={pending}>
      {TEMPLATE_MESSAGES.removeSection}
    </Button>
  );
}
