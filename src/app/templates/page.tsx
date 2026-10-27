import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { currentUser } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { emptyTemplatesMessage, messageForTemplateError, TEMPLATE_MESSAGES } from "@/lib/templates/domain";
import { createTemplate } from "./actions";

// Список шаблонів. Що видно, вирішує RLS: admin — усі шаблони з позначкою «Unpublished changes»; manager — лише
// збережені, без позначки (AC-EDITOR-01, AC-EDITOR-02). Створює шаблон лише admin (дія createTemplate).
export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok) redirect("/login");
  const isAdmin = user.role === "admin";

  const { data: templates, error: loadError } = await supabase
    .from("templates")
    .select("id, name, current_version, has_unpublished_changes")
    .order("name");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Templates</h1>

      {isAdmin ? (
        <form action={createTemplate} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-template-name">Template name</Label>
            <Input id="new-template-name" name="name" required className="w-72" />
          </div>
          <Button type="submit" size="lg">
            Create a template
          </Button>
        </form>
      ) : null}

      {typeof error === "string" ? (
        <Alert variant="destructive">
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
