"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addTaskFormState, type AddTaskEvent, type AddTaskFormState } from "@/lib/templates/domain";
import { addTaskInline } from "../../actions";

// «New task» у розділі редактора. Якщо зміну не збережено — дія повернула помилку або зв'язок утрачено, — повідомлення
// з'являється над полем кольором помилки, а назва лишається в полі (AC-EDITOR-25; design.md, рішення 5).
export function AddTaskForm({ templateId, sectionId }: { templateId: string; sectionId: string }) {
  const [state, setState] = useState<AddTaskFormState>({ name: "", message: null });
  const errorId = `new-task-error-${sectionId}`;

  async function submit(formData: FormData) {
    let event: AddTaskEvent;
    try {
      const result = await addTaskInline(formData);
      event = result.ok ? { type: "saved" } : { type: "rejected", code: result.code };
    } catch {
      event = { type: "unreachable" };
    }
    setState((current) => addTaskFormState(current, event));
  }

  return (
    <form action={submit} noValidate className="flex flex-col gap-2">
      {state.message ? (
        <Alert variant="destructive" id={errorId}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="template_id" value={templateId} />
        <input type="hidden" name="section_id" value={sectionId} />
        <div className="flex flex-col gap-2">
          <Label htmlFor={`new-task-${sectionId}`}>New task</Label>
          <Input
            id={`new-task-${sectionId}`}
            name="name"
            value={state.name}
            onChange={(e) => setState({ ...state, name: e.target.value })}
            className="w-64"
            aria-invalid={state.message ? true : undefined}
            aria-describedby={state.message ? errorId : undefined}
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox id={`new-task-required-${sectionId}`} name="is_required" />
          <Label htmlFor={`new-task-required-${sectionId}`} className="font-normal">
            Required
          </Label>
        </div>
        <AddButton />
      </div>
    </form>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  // Під час відправлення кнопка неактивна, текст дії не змінюємо (DESIGN.md, розділ 6).
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      Add task
    </Button>
  );
}
