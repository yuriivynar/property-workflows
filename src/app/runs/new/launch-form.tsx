import { FormAlert } from "@/components/ui/form-alert";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { requiredLabel, staffLabel } from "@/lib/runs/domain";
import { LABELS } from "@/lib/runs/messages";
import type { parseVersionContent } from "@/lib/templates/version";
import { SubmitButton } from "../submit-button";
import { launchRun } from "./actions";

type Sections = ReturnType<typeof parseVersionContent>["sections"];

// Форма запуску обраного шаблону: назва випадку (помилка — під полем, ADR 0012) і виконавець кожної задачі за
// розділами; за замовчуванням виконавець — менеджер запуску (AC-RUN-04, AC-RUN-08, AC-RUN-09).
export function LaunchForm({
  templateId,
  version,
  sections,
  colleagues,
  message,
  caseNameError,
}: {
  templateId: string;
  version: number | null;
  sections: Sections;
  colleagues: { id: string; email: string | null }[];
  message: string | undefined;
  caseNameError: boolean;
}) {
  return (
    <form action={launchRun} className="flex flex-col gap-5">
      <input type="hidden" name="template_id" value={templateId} />
      <input type="hidden" name="expected_version" value={version ?? ""} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="case_name">{LABELS.caseName}</Label>
        <Input
          id="case_name"
          name="case_name"
          type="text"
          placeholder={LABELS.caseNamePlaceholder}
          autoFocus={caseNameError || undefined}
          aria-invalid={caseNameError || undefined}
          aria-describedby={message ? "launch-error" : undefined}
        />
        {caseNameError ? (
          <FieldError id="launch-error" fieldId="case_name">
            {message}
          </FieldError>
        ) : null}
      </div>

      {sections.map((section) => (
        <Card key={section.id} className="gap-3 px-4">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-base font-semibold">{section.name}</legend>
            {section.tasks
              .map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <Label htmlFor={`assignee:${task.id}`} className="font-normal">
                    {task.name}{" "}
                    <span className="text-muted-foreground">({requiredLabel(task.is_required)})</span>
                  </Label>
                  <NativeSelect
                    id={`assignee:${task.id}`}
                    name={`assignee:${task.id}`}
                    defaultValue=""
                    aria-label={LABELS.assigneeOf(task.name)}
                  >
                    <NativeSelectOption value="">{LABELS.meAsRunManager}</NativeSelectOption>
                    {colleagues.map((person) => (
                      <NativeSelectOption key={person.id} value={person.id}>
                        {staffLabel(person)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              ))}
          </fieldset>
        </Card>
      ))}

      {message && !caseNameError ? (
        <FormAlert id="launch-error" title={LABELS.runNotLaunched}>
          {message}
        </FormAlert>
      ) : null}
      <div>
        <SubmitButton label={LABELS.launch} pendingLabel={LABELS.launching} />
      </div>
    </form>
  );
}
