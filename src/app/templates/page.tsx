import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { currentUser } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { unpublishedTemplateIds } from "@/lib/templates/queries";
import {
  emptyTemplatesMessage,
  messageForTemplateError,
  TEMPLATE_MESSAGES,
  templatePageAccess,
} from "@/lib/templates/domain";
import { CreateTemplateForm, TemplateCard } from "./template-parts";
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
        {isAdmin ? <CreateTemplateForm error={nameError ? String(error) : undefined} /> : null}
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
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              version={currentVersion.get(template.id)}
              unpublished={isAdmin && unpublished.has(template.id)}
              isAdmin={isAdmin}
              emails={emails}
            />
          ))}
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
