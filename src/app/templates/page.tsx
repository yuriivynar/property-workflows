import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { currentUser } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { LABELS } from "@/lib/runs/messages";
import { emptyTemplatesMessage, messageForTemplateError, TEMPLATE_MESSAGES, templatePageAccess } from "@/lib/templates/domain";
import { createTemplate } from "./actions";

// Список шаблонів. Що видно, вирішує RLS: admin — усі шаблони з позначкою «Unpublished changes»; manager — лише
// збережені, без позначки (AC-EDITOR-01, AC-EDITOR-02). Створює шаблон лише admin (дія createTemplate).
export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok) redirect("/login");
  // Вендор шаблонів не бачить: «Not enough rights» і жодного шаблону; шаблони для нього не запитуються, а RLS однаково
  // не віддала б жодного (AC-VENDOR-08).
  if (templatePageAccess(user.role, "list") !== "ok") {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Notice message={TEMPLATE_MESSAGES.notEnoughRights} backHref="/runs" backLabel={LABELS.backToRuns} />
      </main>
    );
  }
  const isAdmin = user.role === "admin";
  // Помилка назви пов'язана з полем (DESIGN.md, розділ 7; рев'ю CodeRabbit, PR #23).
  const nameError = error === "TEMPLATE_NAME_REQUIRED" || error === "NAME_TAKEN";

  const { data: templates, error: loadError } = await supabase
    .from("templates")
    .select("id, name, current_version, has_unpublished_changes")
    .order("name");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold">Templates</h1>

      {/* noValidate: порожню назву перевіряє дія й показує «Enter a template name» (AC-EDITOR-19), а не підказка браузера. */}
      {isAdmin ? (
        <form action={createTemplate} noValidate className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2 max-sm:min-w-0 max-sm:flex-1">
            <Label htmlFor="new-template-name">Template name</Label>
            <Input
              id="new-template-name"
              name="name"
              required
              className="w-full sm:w-72"
              aria-invalid={nameError || undefined}
              aria-describedby={nameError ? "template-error" : undefined}
            />
          </div>
          <Button type="submit" size="lg">
            Create a template
          </Button>
        </form>
      ) : null}

      {typeof error === "string" ? (
        <Alert variant="destructive" id="template-error">
          <AlertDescription>{messageForTemplateError(error)}</AlertDescription>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{TEMPLATE_MESSAGES.notLoaded}</AlertDescription>
        </Alert>
      ) : templates && templates.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Current version</TableHead>
              {isAdmin ? <TableHead>Changes</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id} data-testid="template-row">
                <TableCell className="py-2">
                  <TextLink href={`/templates/${template.id}`}>{template.name}</TextLink>
                </TableCell>
                <TableCell className="py-2 tabular-nums">
                  {template.current_version ? TEMPLATE_MESSAGES.version(template.current_version) : "—"}
                </TableCell>
                {isAdmin ? (
                  <TableCell className="py-2">
                    {template.has_unpublished_changes ? <StatusBadge status="unpublished" /> : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          message={emptyTemplatesMessage(user.role)}
          actionHref={isAdmin ? "#new-template-name" : undefined}
          actionLabel={isAdmin ? TEMPLATE_MESSAGES.createTemplate : undefined}
        />
      )}

      <TextLink href="/runs" className="w-fit text-sm">
        Runs
      </TextLink>
    </main>
  );
}
