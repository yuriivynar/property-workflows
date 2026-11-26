import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { messageForTemplateError } from "@/lib/templates/domain";
import { renameTemplate } from "../../actions";
import { AutosaveInput } from "./autosave-input";

/**
 * Перейменування шаблону: назва зберігається, щойно поле втратило фокус, або Enter (кнопки «Rename» немає; ADR 0012). noValidate: порожню назву перевіряє дія й показує «Enter a template name» (AC-EDITOR-19)
 * під полем; «A template with this name already exists» — теж під полем; помилка зникає, щойно поле змінили (ADR 0012).
 */
export function RenameForm({ templateId, workingName, error }: { templateId: string; workingName: string; error: string | undefined }) {
  return (
    <form action={renameTemplate} noValidate className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="template_id" value={templateId} />
      <div className="flex flex-col gap-2 max-sm:min-w-0 max-sm:flex-1">
        <Label htmlFor="template-name">Template name</Label>
        <AutosaveInput
          id="template-name"
          name="name"
          defaultValue={workingName}
          className="w-full sm:w-72"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "editor-name-error" : undefined}
        />
        {error ? (
          <FieldError id="editor-name-error" fieldId="template-name">
            {messageForTemplateError(error)}
          </FieldError>
        ) : null}
      </div>
    </form>
  );
}
