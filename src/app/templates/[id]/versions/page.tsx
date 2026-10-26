import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { currentUser } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { formatVersionDate, newestFirst, TEMPLATE_MESSAGES, templatePageAccess } from "@/lib/templates/domain";

// Список версій — лише адміністратор: номер, дата й час збереження за Києвом (DD.MM.YYYY HH:MM), email автора,
// найновіша перша (AC-EDITOR-05). Менеджер бачить «Not enough rights» і жодної версії; версії для нього не
// запитуються (AC-EDITOR-07), а RLS однаково віддала б лише поточну.
export default async function TemplateVersionsPage({ params }: PageProps<"/templates/[id]/versions">) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok) redirect("/login");

  if (templatePageAccess(user.role, "versions") !== "ok") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <Notice message={TEMPLATE_MESSAGES.notEnoughRights} backHref="/templates" backLabel={TEMPLATE_MESSAGES.backToTemplates} />
      </main>
    );
  }

  const [{ data: template }, { data: versions }] = await Promise.all([
    supabase.from("templates").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("template_versions").select("id, number, created_at, created_by").eq("template_id", id),
  ]);

  if (!template) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
        <Notice message={TEMPLATE_MESSAGES.templateNotFound} backHref="/templates" backLabel={TEMPLATE_MESSAGES.backToTemplates} />
      </main>
    );
  }

  // Email автора: адміністратор читає профілі інших користувачів (матриця прав, «See other users' profiles»).
  const authorIds = [...new Set((versions ?? []).map((v) => v.created_by).filter((v): v is string => Boolean(v)))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, email").in("id", authorIds)
    : { data: [] };
  const emailOf = new Map((authors ?? []).map((a) => [a.id, a.email]));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Versions</h1>
        <p className="text-sm text-muted-foreground">{template.name}</p>
      </div>

      {versions && versions.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Version</TableHead>
              <TableHead>Saved</TableHead>
              <TableHead>Saved by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {newestFirst(versions).map((version) => (
              <TableRow key={version.id} data-testid="version-row">
                <TableCell className="py-2 tabular-nums">{TEMPLATE_MESSAGES.version(version.number)}</TableCell>
                <TableCell className="py-2 tabular-nums">{formatVersionDate(version.created_at)}</TableCell>
                <TableCell className="py-2">{(version.created_by && emailOf.get(version.created_by)) ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState message={TEMPLATE_MESSAGES.noVersions} />
      )}

      <p className="flex gap-4 text-sm">
        <TextLink href={`/templates/${template.id}/edit`}>Edit</TextLink>
        <TextLink href="/templates">{TEMPLATE_MESSAGES.backToTemplates}</TextLink>
      </p>
    </main>
  );
}
