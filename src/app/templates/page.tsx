import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { TextLink } from "@/components/ui/text-link";
import { currentUser } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { unpublishedTemplateIds } from "@/lib/templates/queries";
import {
  emptyTemplatesMessage,
  messageForTemplateError,
  TEMPLATE_MESSAGES,
  templatePageAccess,
  formatVersionDate,
  versionSummary,
} from "@/lib/templates/domain";
import { createTemplate } from "./actions";
import { NotEnoughRights } from "@/components/not-enough-rights";

// Список шаблонів. Що видно, вирішує RLS: admin — усі шаблони з позначкою «Unpublished changes»; manager — лише
// збережені, без позначки (AC-EDITOR-01, AC-EDITOR-02). Створює шаблон лише admin (дія createTemplate).
export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok) redirect("/login");
  // Вендор шаблонів не бачить: «Not enough rights» і жодного шаблону; шаблони для нього не запитуються, а RLS однаково
  // не віддала б жодного (AC-VENDOR-08).
  if (templatePageAccess(user.role, "list") !== "ok") return <NotEnoughRights role={user.role} />;
  const isAdmin = user.role === "admin";
  // Помилка назви пов'язана з полем (DESIGN.md, розділ 7; рев'ю CodeRabbit, PR #23).
  const nameError = error === "TEMPLATE_NAME_REQUIRED" || error === "NAME_TAKEN";

  const [{ data: templates, error: loadError }, unpublished, { data: versions }, { data: staff }] = await Promise.all([
    supabase.from("templates").select("id, name, current_version").order("name"),
    unpublishedTemplateIds(supabase, isAdmin),
    // Поточна збережена версія — для лічильників і «Saved … by …» на картці (менеджер бачить лише поточні, RLS).
    supabase.from("template_versions").select("template_id, number, content, created_by, created_at"),
    supabase.rpc("staff_directory"),
  ]);
  const emails = new Map((staff ?? []).map((person) => [person.id, person.email]));
  const currentVersion = new Map(
    (versions ?? [])
      .filter((version) => templates?.some((t) => t.id === version.template_id && t.current_version === version.number))
      .map((version) => [version.template_id, version]),
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="text-sm text-muted-foreground">{TEMPLATE_MESSAGES.templatesSubtitle}</p>
        </div>
        {/* noValidate: порожню назву перевіряє дія й показує «Enter a template name» (AC-EDITOR-19) під полем, а не
            підказка браузера; помилка зникає з наступним відправленням (DESIGN.md, розділ 6; ADR 0012). */}
        {isAdmin ? (
          <form action={createTemplate} noValidate className="flex flex-wrap items-start gap-3">
            <div className="flex flex-col gap-2 max-sm:min-w-0 max-sm:flex-1">
              <Label htmlFor="new-template-name">Template name</Label>
              <Input
                id="new-template-name"
                name="name"
                required
                autoFocus={nameError || undefined}
                className="w-full sm:w-64"
                aria-invalid={nameError || undefined}
                aria-describedby={nameError ? "template-error" : undefined}
              />
              {nameError ? (
                <FieldError id="template-error" fieldId="new-template-name">
                  {messageForTemplateError(String(error))}
                </FieldError>
              ) : null}
            </div>
            <Button type="submit" size="lg" className="sm:mt-7">
              Create a template
            </Button>
          </form>
        ) : null}
      </div>

      {typeof error === "string" && !nameError ? (
        <Alert variant="destructive">
          <AlertDescription>{messageForTemplateError(error)}</AlertDescription>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{TEMPLATE_MESSAGES.notLoaded}</AlertDescription>
        </Alert>
      ) : templates && templates.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]">
          {templates.map((template) => {
            const version = currentVersion.get(template.id);
            const summary = versionSummary(version?.content);
            return (
              <li
                key={template.id}
                data-testid="template-row"
                className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-[transform,border-color] duration-(--duration-fast) ease-standard hover:-translate-y-0.5 hover:border-input motion-reduce:hover:translate-y-0"
              >
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold [overflow-wrap:anywhere]">
                    <TextLink href={`/templates/${template.id}`} className="no-underline after:absolute after:inset-0 hover:underline">
                      {template.name}
                    </TextLink>
                  </h2>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {template.current_version ? TEMPLATE_MESSAGES.currentVersion(template.current_version) : TEMPLATE_MESSAGES.noVersionsYet}
                  </p>
                </div>
                {isAdmin && unpublished.has(template.id) ? (
                  <span>
                    <StatusBadge status="unpublished" />
                  </span>
                ) : null}
                {version ? (
                  <>
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-muted-foreground">
                      <span><span className="font-semibold text-foreground">{summary.sections}</span> sections</span>
                      <span><span className="font-semibold text-foreground">{summary.tasks}</span> tasks</span>
                      <span><span className="font-semibold text-foreground">{summary.required}</span> required</span>
                    </p>
                    <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      {TEMPLATE_MESSAGES.savedBy(formatVersionDate(version.created_at), version.created_by ? emails.get(version.created_by) ?? null : null)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{TEMPLATE_MESSAGES.saveToLaunch}</p>
                )}
                {isAdmin ? (
                  <div className="relative z-10 mt-auto flex gap-4 border-t border-border pt-3 text-sm">
                    <TextLink href={`/templates/${template.id}/edit`} className="font-medium no-underline hover:underline">Edit</TextLink>
                    <TextLink href={`/templates/${template.id}/versions`} className="font-medium no-underline hover:underline">Versions</TextLink>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          message={emptyTemplatesMessage(user.role)}
          actionHref={isAdmin ? "#new-template-name" : undefined}
          actionLabel={isAdmin ? TEMPLATE_MESSAGES.createTemplate : undefined}
        />
      )}

    </main>
  );
}
