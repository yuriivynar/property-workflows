import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { TextLink } from "@/components/ui/text-link";
import { currentUser } from "@/lib/auth/require-role";
import { requiredLabel } from "@/lib/runs/domain";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_MESSAGES } from "@/lib/templates/domain";
import { parseVersionContent } from "@/lib/templates/version";
import Link from "next/link";

// Шаблон лише для читання: поточна збережена версія — «Version N», розділи й задачі з «required» / «optional»
// (AC-EDITOR-02; робоче рішення до solomchaak/property-workflows-spec#25). Незбереженого шаблону менеджер не бачить:
// RLS не повертає рядка → «Template not found» (робоче рішення до solomchaak/property-workflows-spec#26).
export default async function TemplatePage({ params }: PageProps<"/templates/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok) redirect("/login");
  const isAdmin = user.role === "admin";

  const { data: template } = await supabase
    .from("templates")
    .select("id, name, current_version, has_unpublished_changes")
    .eq("id", id)
    .maybeSingle();

  if (!template) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <Notice message={TEMPLATE_MESSAGES.templateNotFound} backHref="/templates" backLabel={TEMPLATE_MESSAGES.backToTemplates} />
      </main>
    );
  }

  const { data: version } = template.current_version
    ? await supabase
        .from("template_versions")
        .select("content")
        .eq("template_id", template.id)
        .eq("number", template.current_version)
        .maybeSingle()
    : { data: null };
  const sections = parseVersionContent(version?.content).sections;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{template.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {template.current_version ? TEMPLATE_MESSAGES.version(template.current_version) : "—"}
            {isAdmin && template.has_unpublished_changes ? <StatusBadge status="unpublished" /> : null}
          </p>
        </div>
        {template.current_version ? (
          <Link href={`/runs/new?template=${template.id}`} className={buttonVariants({ size: "lg" })}>
            Launch
          </Link>
        ) : null}
      </div>

      {isAdmin ? (
        <p className="flex gap-4 text-sm">
          <TextLink href={`/templates/${template.id}/edit`}>Edit</TextLink>
          <TextLink href={`/templates/${template.id}/versions`}>Versions</TextLink>
        </p>
      ) : null}

      {sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{section.name}</h2>
          <Card className="gap-0 py-0">
            <ul className="flex flex-col divide-y divide-border">
              {section.tasks.map((task) => (
                <li key={task.id} data-testid="template-task" className="px-4 py-3 text-sm">
                  {task.name} <span className="text-muted-foreground">({requiredLabel(task.is_required)})</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}

      <TextLink href="/templates" className="w-fit text-sm">
        {TEMPLATE_MESSAGES.backToTemplates}
      </TextLink>
    </main>
  );
}
