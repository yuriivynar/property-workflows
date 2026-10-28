import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { TextLink } from "@/components/ui/text-link";
import { currentUser } from "@/lib/auth/require-role";
import { requiredLabel } from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";
import { messageForTemplateError, TEMPLATE_MESSAGES, templatePageAccess } from "@/lib/templates/domain";
import {
  addSection,
  addTask,
  moveItem,
  removeTask,
  renameSection,
  renameTemplate,
  renameTask,
  saveVersion,
  setTaskRequired,
} from "../../actions";
import { RemoveSectionButton } from "./remove-section-button";

// Редактор шаблону — лише адміністратор. Менеджер бачить «Not enough rights» і «Back to templates» у тому самому
// макеті, без жодних даних редактора: дані для нього навіть не запитуються (AC-DSYS-02). Кожна зміна — окрема дія,
// що одразу пише незбережені зміни (AC-EDITOR-01); «Save» створює версію (AC-EDITOR-03, AC-EDITOR-04).
export default async function EditTemplatePage({ params, searchParams }: PageProps<"/templates/[id]/edit">) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok) redirect("/login");

  if (templatePageAccess(user.role, "edit") !== "ok") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <Notice message={TEMPLATE_MESSAGES.notEnoughRights} backHref="/templates" backLabel={TEMPLATE_MESSAGES.backToTemplates} />
      </main>
    );
  }

  const [
    { data: template },
    { data: draftName, error: draftNameError },
    { data: sections, error: sectionsError },
    { data: tasks, error: tasksError },
  ] = await Promise.all([
    supabase.from("templates").select("id, name, current_version, has_unpublished_changes").eq("id", id).maybeSingle(),
    // Робоча назва — у незбережених змінах; менеджер бачить назву поточної версії (AC-EDITOR-21).
    supabase.from("template_draft_names").select("name").eq("template_id", id).maybeSingle(),
    supabase.from("template_sections").select("id, name, position").eq("template_id", id).order("position"),
    supabase
      .from("template_tasks")
      .select("id, section_id, name, is_required, position")
      .eq("template_id", id)
      .order("position"),
  ]);

  if (!template) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <Notice message={TEMPLATE_MESSAGES.templateNotFound} backHref="/templates" backLabel={TEMPLATE_MESSAGES.backToTemplates} />
      </main>
    );
  }

  // Помилку читання незбережених змін не показуємо як порожній шаблон (рев'ю CodeRabbit, PR #18).
  if (sectionsError || tasksError || draftNameError) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <Notice message={TEMPLATE_MESSAGES.notLoaded} backHref="/templates" backLabel={TEMPLATE_MESSAGES.backToTemplates} />
      </main>
    );
  }

  const savedNumber = typeof saved === "string" ? Number(saved) : NaN;
  const hidden = <input type="hidden" name="template_id" value={template.id} />;
  const workingName = draftName?.name ?? template.name;
  const nameError = error === "TEMPLATE_NAME_REQUIRED" || error === "NAME_TAKEN";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{workingName}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {template.current_version ? `Current: ${TEMPLATE_MESSAGES.version(template.current_version)}` : "Never saved"}
            {template.has_unpublished_changes ? <StatusBadge status="unpublished" /> : null}
          </p>
        </div>
        <form action={saveVersion}>
          {hidden}
          {/* «Save» без незбережених змін неактивна (робоче рішення до solomchaak/property-workflows-spec#22). */}
          <Button type="submit" size="lg" disabled={!template.has_unpublished_changes}>
            Save
          </Button>
        </form>
      </div>

      {typeof error === "string" ? (
        <Alert variant="destructive" id="editor-error">
          <AlertDescription>{messageForTemplateError(error)}</AlertDescription>
        </Alert>
      ) : null}

      {/* noValidate: порожню назву перевіряє дія й показує «Enter a template name». */}
      <form action={renameTemplate} noValidate className="flex flex-wrap items-end gap-2">
        {hidden}
        <div className="flex flex-col gap-2">
          <Label htmlFor="template-name">Template name</Label>
          <Input
            id="template-name"
            name="name"
            defaultValue={workingName}
            className="w-72"
            aria-invalid={nameError || undefined}
            aria-describedby={nameError ? "editor-error" : undefined}
          />
        </div>
        <Button type="submit" variant="secondary">
          Rename
        </Button>
      </form>
      {Number.isInteger(savedNumber) && savedNumber > 0 ? (
        <p role="status" className="text-sm">
          {TEMPLATE_MESSAGES.versionSaved(savedNumber)}
        </p>
      ) : null}

      {(sections ?? []).map((section, index, all) => (
        <section key={section.id} className="flex flex-col gap-2">
          <Card className="gap-4 px-4">
            <div className="flex flex-wrap items-end gap-2">
              <form action={renameSection} className="flex flex-wrap items-end gap-2">
                {hidden}
                <input type="hidden" name="section_id" value={section.id} />
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`section-${section.id}`}>Section</Label>
                  <Input id={`section-${section.id}`} name="name" defaultValue={section.name} required className="w-64" />
                </div>
                <Button type="submit" variant="outline">
                  Rename
                </Button>
              </form>
              <MoveButtons templateId={template.id} kind="section" itemId={section.id} first={index === 0} last={index === all.length - 1} />
              <RemoveSectionButton templateId={template.id} sectionId={section.id} sectionName={section.name} />
            </div>

            <ul className="flex flex-col divide-y divide-border">
              {(tasks ?? [])
                .filter((task) => task.section_id === section.id)
                .map((task, taskIndex, sectionTasks) => (
                  <li key={task.id} data-testid="editor-task" className="flex flex-wrap items-end gap-2 py-3 text-sm">
                    <form action={renameTask} className="flex flex-wrap items-end gap-2">
                      {hidden}
                      <input type="hidden" name="task_id" value={task.id} />
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`task-${task.id}`} className="font-normal">
                          Task <span className="text-muted-foreground">({requiredLabel(task.is_required)})</span>
                        </Label>
                        <Input id={`task-${task.id}`} name="name" defaultValue={task.name} required className="w-64" />
                      </div>
                      <Button type="submit" variant="outline">
                        Rename
                      </Button>
                    </form>
                    <form action={setTaskRequired}>
                      {hidden}
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="is_required" value={task.is_required ? "false" : "true"} />
                      <Button type="submit" variant="outline">
                        {task.is_required ? "Make optional" : "Make required"}
                      </Button>
                    </form>
                    <MoveButtons
                      templateId={template.id}
                      kind="task"
                      itemId={task.id}
                      first={taskIndex === 0}
                      last={taskIndex === sectionTasks.length - 1}
                    />
                    <form action={removeTask}>
                      {hidden}
                      <input type="hidden" name="task_id" value={task.id} />
                      <Button type="submit" variant="ghost">
                        Remove
                      </Button>
                    </form>
                  </li>
                ))}
            </ul>

            <form action={addTask} className="flex flex-wrap items-end gap-2">
              {hidden}
              <input type="hidden" name="section_id" value={section.id} />
              <div className="flex flex-col gap-2">
                <Label htmlFor={`new-task-${section.id}`}>New task</Label>
                <Input id={`new-task-${section.id}`} name="name" required className="w-64" />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Checkbox id={`new-task-required-${section.id}`} name="is_required" />
                <Label htmlFor={`new-task-required-${section.id}`} className="font-normal">
                  Required
                </Label>
              </div>
              <Button type="submit" variant="outline">
                Add task
              </Button>
            </form>
          </Card>
        </section>
      ))}

      <form action={addSection} className="flex flex-wrap items-end gap-2">
        {hidden}
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-section">New section</Label>
          <Input id="new-section" name="name" required className="w-64" />
        </div>
        <Button type="submit" variant="outline">
          Add section
        </Button>
      </form>

      <p className="flex gap-4 text-sm">
        <TextLink href={`/templates/${template.id}/versions`}>Versions</TextLink>
        <TextLink href="/templates">{TEMPLATE_MESSAGES.backToTemplates}</TextLink>
      </p>
    </main>
  );
}

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
    <form action={moveItem} className="flex gap-1">
      <input type="hidden" name="template_id" value={templateId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="item_id" value={itemId} />
      <Button type="submit" name="direction" value="up" variant="outline" disabled={first}>
        Move up
      </Button>
      <Button type="submit" name="direction" value="down" variant="outline" disabled={last}>
        Move down
      </Button>
    </form>
  );
}
