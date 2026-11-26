import { redirect } from "next/navigation";
import { FormAlert } from "@/components/ui/form-alert";
import { AutosaveStatus } from "./autosave-status";
import { RenameForm } from "./rename-form";
import Link from "next/link";
import { History, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { currentUser } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { unpublishedTemplateIds } from "@/lib/templates/queries";
import {
  editorErrorPlace,
  editorErrorTitle,
  messageForTemplateError,
  TEMPLATE_MESSAGES,
  templatePageAccess,
} from "@/lib/templates/domain";
import { addSection, saveVersion } from "../../actions";
import { EditorSection } from "./editor-parts";
import { NotEnoughRights } from "@/components/not-enough-rights";
import { Notice } from "@/components/ui/notice";
import { BackLink } from "@/components/ui/back-link";

// Редактор шаблону — лише адміністратор. Менеджер бачить «Not enough rights» і «Back to templates» у тому самому
// макеті, без жодних даних редактора: дані для нього навіть не запитуються (AC-DSYS-02). Кожна зміна — окрема дія,
// що одразу пише незбережені зміни (AC-EDITOR-01); «Save» створює версію (AC-EDITOR-03, AC-EDITOR-04).
export default async function EditTemplatePage({ params, searchParams }: PageProps<"/templates/[id]/edit">) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok) redirect("/login");

  if (templatePageAccess(user.role, "edit") !== "ok") return <NotEnoughRights role={user.role} />;

  const [
    unpublished,
    { data: template },
    { data: draftName, error: draftNameError },
    { data: sections, error: sectionsError },
    { data: tasks, error: tasksError },
  ] = await Promise.all([
    // Сторінка редактора — лише для адміністратора (templatePageAccess вище), тож позначку запитуємо завжди.
    unpublishedTemplateIds(supabase, true),
    supabase.from("templates").select("id, name, current_version").eq("id", id).maybeSingle(),
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
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Notice message={TEMPLATE_MESSAGES.templateNotFound} backHref="/templates" backLabel={TEMPLATE_MESSAGES.backToTemplates} />
      </main>
    );
  }
  const hasUnpublishedChanges = unpublished.has(template.id);

  // Помилку читання незбережених змін не показуємо як порожній шаблон (рев'ю CodeRabbit, PR #18).
  if (sectionsError || tasksError || draftNameError) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Notice message={TEMPLATE_MESSAGES.notLoaded} backHref="/templates" backLabel={TEMPLATE_MESSAGES.backToTemplates} />
      </main>
    );
  }

  const savedNumber = typeof saved === "string" ? Number(saved) : NaN;
  const hidden = <input type="hidden" name="template_id" value={template.id} />;
  const workingName = draftName?.name ?? template.name;
  // Автозбереження: «Your last change was not kept. Try again.» — в одному фіксованому місці, у рядку збереження
  // (AC-EDITOR-25; ADR 0012); решта помилок — Alert форми з фокусом або помилка під полем назви.
  const place = typeof error === "string" ? editorErrorPlace(error) : null;
  const formError = place === "form" ? String(error) : undefined;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      {/* Кнопка «назад» угорі (рішення власника 2026-11-26, ADR 0012). */}
      <BackLink href="/templates">{TEMPLATE_MESSAGES.backToTemplates}</BackLink>
      {/* Рядок збереження липне до верху: «Save» і «Unpublished changes» видно, поки прокручуєш довгий шаблон. */}
      <div className="static z-10 -mx-4 [@media(min-height:40rem)]:sticky [@media(min-height:40rem)]:top-0 flex flex-wrap items-start justify-between gap-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{workingName}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {template.current_version ? `Current: ${TEMPLATE_MESSAGES.version(template.current_version)}` : "Never saved"}
            {hasUnpublishedChanges ? <StatusBadge status="unpublished" /> : null}
            <AutosaveStatus failed={place === "autosave"} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/templates/${template.id}/versions`} className={buttonVariants({ variant: "outline", size: "lg" })}>
            <History aria-hidden="true" />
            Versions
          </Link>
          <form action={saveVersion}>
            {hidden}
            {/* «Save» без незбережених змін неактивна (робоче рішення до solomchaak/property-workflows-spec#22). */}
            <Button type="submit" size="lg" disabled={!hasUnpublishedChanges}>
              Save
            </Button>
          </form>
        </div>
      </div>

      {formError ? (
        <FormAlert id="editor-error" title={editorErrorTitle(formError, template.current_version)}>
          {messageForTemplateError(formError)}
        </FormAlert>
      ) : null}

      {/* noValidate: порожню назву перевіряє дія й показує «Enter a template name». */}
      <RenameForm templateId={template.id} workingName={workingName} error={editorErrorPlace(String(error)) === "name" ? String(error) : undefined} />
      {Number.isInteger(savedNumber) && savedNumber > 0 ? (
        <p role="status" className="text-sm">
          {TEMPLATE_MESSAGES.versionSaved(savedNumber)}
        </p>
      ) : null}

      {(sections ?? []).map((section, index, all) => (
        <EditorSection key={section.id} templateId={template.id} section={section} index={index} sections={all} tasks={tasks ?? []} />
      ))}

      {/* Новий розділ — пунктирна картка під розділами (рішення власника 2026-11-26, ADR 0012). */}
      <form action={addSection} className="flex flex-col gap-2 rounded-xl border border-dashed border-input p-4 sm:flex-row sm:items-end">
        {hidden}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="new-section">New section</Label>
          <Input id="new-section" name="name" required className="w-full sm:max-w-sm" />
        </div>
        <Button type="submit" variant="outline">
          <Plus aria-hidden="true" />
          Add section
        </Button>
      </form>
    </main>
  );
}

