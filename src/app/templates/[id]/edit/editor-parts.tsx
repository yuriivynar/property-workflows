import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { requiredLabel } from "@/lib/runs/domain";
import { moveItem, moveTaskToSection, removeTask, renameSection, renameTask, setTaskRequired } from "../../actions";
import { AddTaskForm } from "./add-task-form";
import { RemoveSectionButton } from "./remove-section-button";

// Частини редактора шаблону (рішення власника 2026-11-26, ADR 0012): розділ — картка з графітовим номером і рядком
// дій у шапці; задача — рядок «позначка required/optional · назва · дії», вирівняний сіткою; дії рядка — іконки з тими
// самими доступними назвами («Move up», «Move down», «Remove»), підказка — title. Головна дія екрана лишається одна —
// «Save» у рядку збереження (DESIGN.md, розділ 5).

export interface EditorSectionData {
  id: string;
  name: string;
}
export interface EditorTaskData {
  id: string;
  section_id: string;
  name: string;
  is_required: boolean;
}

// Іконка-кнопка рядка: ≥ 44 px на телефоні, 32 px від sm.
const ICON_BUTTON = "size-11 text-muted-foreground hover:text-foreground sm:size-8";
const REMOVE_BUTTON = "size-11 text-muted-foreground hover:bg-destructive-surface hover:text-destructive sm:size-8";

function MoveButtons({
  templateId,
  kind,
  itemId,
  first,
  last,
}: {
  templateId: string;
  kind: "section" | "task";
  itemId: string;
  first: boolean;
  last: boolean;
}) {
  return (
    <form action={moveItem} className="flex gap-0.5">
      <input type="hidden" name="template_id" value={templateId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="item_id" value={itemId} />
      <Button type="submit" name="direction" value="up" variant="ghost" size="icon" disabled={first} aria-label="Move up" title="Move up" className={ICON_BUTTON}>
        <ArrowUp aria-hidden="true" className="size-4" />
      </Button>
      <Button type="submit" name="direction" value="down" variant="ghost" size="icon" disabled={last} aria-label="Move down" title="Move down" className={ICON_BUTTON}>
        <ArrowDown aria-hidden="true" className="size-4" />
      </Button>
    </form>
  );
}

/** Позначка задачі: «required» — суцільна крапка кольору прогресу, «optional» — пунктирне кільце (як у UrgencyMenu). */
function RequiredMark({ required }: { required: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex w-24 shrink-0 items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground"
    >
      <span className={cn("size-2 rounded-full", required ? "bg-fill-progress" : "border border-dashed border-muted-foreground")} />
      {requiredLabel(required)}
    </span>
  );
}

function EditorTask({
  templateId,
  task,
  first,
  last,
  sections,
}: {
  templateId: string;
  task: EditorTaskData;
  first: boolean;
  last: boolean;
  sections: readonly EditorSectionData[];
}) {
  const hidden = <input type="hidden" name="template_id" value={templateId} />;
  return (
    <li data-testid="editor-task" className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:gap-3">
      <RequiredMark required={task.is_required} />
      <form action={renameTask} noValidate className="rename-scope flex min-w-0 flex-1 items-center gap-2">
        {hidden}
        <input type="hidden" name="task_id" value={task.id} />
        {/* Доступна назва поля — як раніше: «Task (required)» / «Task (optional)»; на екрані стан видно позначкою. */}
        <Label htmlFor={`task-${task.id}`} className="sr-only">
          Task ({requiredLabel(task.is_required)})
        </Label>
        <Input id={`task-${task.id}`} name="name" defaultValue={task.name} className="min-w-0 flex-1" />
        <Button type="submit" variant="outline" className="rename-btn">
          Rename
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-1">
        <form action={setTaskRequired}>
          {hidden}
          <input type="hidden" name="task_id" value={task.id} />
          <input type="hidden" name="is_required" value={task.is_required ? "false" : "true"} />
          <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            {task.is_required ? "Make optional" : "Make required"}
          </Button>
        </form>
        <MoveButtons templateId={templateId} kind="task" itemId={task.id} first={first} last={last} />
        {sections.length > 1 ? (
          <form action={moveTaskToSection} className="flex items-center gap-1">
            {hidden}
            <input type="hidden" name="task_id" value={task.id} />
            <Label htmlFor={`move-${task.id}`} className="sr-only">
              Section
            </Label>
            <NativeSelect id={`move-${task.id}`} name="section_id" defaultValue={task.section_id} size="sm">
              {sections.map((target) => (
                <NativeSelectOption key={target.id} value={target.id}>
                  {target.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button type="submit" variant="ghost" size="sm">
              Move
            </Button>
          </form>
        ) : null}
        <form action={removeTask}>
          {hidden}
          <input type="hidden" name="task_id" value={task.id} />
          <Button type="submit" variant="ghost" size="icon" aria-label="Remove" title="Remove task" className={REMOVE_BUTTON}>
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        </form>
      </div>
    </li>
  );
}

/** Розділ редактора: шапка (номер, назва, дії розділу), задачі, «New task» унизу картки. */
export function EditorSection({
  templateId,
  section,
  index,
  sections,
  tasks,
}: {
  templateId: string;
  section: EditorSectionData;
  index: number;
  sections: readonly EditorSectionData[];
  tasks: readonly EditorTaskData[];
}) {
  const sectionTasks = tasks.filter((task) => task.section_id === section.id);
  return (
    <section aria-label={`Section ${index + 1}: ${section.name}`}>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b border-border bg-muted px-4 py-3 sm:flex-row sm:items-center">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-hero text-xs font-semibold tabular-nums text-hero-foreground"
          >
            {index + 1}
          </span>
          <form action={renameSection} noValidate className="rename-scope flex min-w-0 flex-1 items-center gap-2">
            <input type="hidden" name="template_id" value={templateId} />
            <input type="hidden" name="section_id" value={section.id} />
            <Label htmlFor={`section-${section.id}`} className="sr-only">
              Section
            </Label>
            <Input
              id={`section-${section.id}`}
              name="name"
              defaultValue={section.name}
              className="min-w-0 flex-1 bg-card font-semibold sm:max-w-sm"
            />
            <Button type="submit" variant="outline" className="rename-btn">
              Rename
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs tabular-nums text-muted-foreground">
              {sectionTasks.length} {sectionTasks.length === 1 ? "task" : "tasks"}
            </span>
            <MoveButtons templateId={templateId} kind="section" itemId={section.id} first={index === 0} last={index === sections.length - 1} />
            <RemoveSectionButton templateId={templateId} sectionId={section.id} sectionName={section.name} />
          </div>
        </div>

        <ul className="flex flex-col divide-y divide-border px-4">
          {sectionTasks.map((task, taskIndex) => (
            <EditorTask
              key={task.id}
              templateId={templateId}
              task={task}
              first={taskIndex === 0}
              last={taskIndex === sectionTasks.length - 1}
              sections={sections}
            />
          ))}
        </ul>

        <div className="border-t border-dashed border-border bg-glow px-4 py-3">
          <AddTaskForm templateId={templateId} sectionId={section.id} />
        </div>
      </Card>
    </section>
  );
}
