import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { DOCUMENT_ERRORS, DOCUMENT_LABELS } from "@/lib/documents/form";
import type { createClient } from "@/lib/supabase/server";
import { confirmDocumentValues, requestDocumentValues } from "./actions";
import { DocumentParsingForm } from "./document-parsing-form";
import { DocumentValuesList } from "./document-values-list";

type Props = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  runId: string;
  viewer: { role: string | null; userId: string };
  runManagerId: string;
  names: Map<string, string>;
};

/**
 * Розділи «Parse a document» і «Document values» сторінки запуску — лише адміністратору й менеджеру цього запуску
 * (варіант A solomchaak/property-workflows-spec#53); ті самі правила перевіряють дії й RLS run_document_values.
 */
export async function RunDocuments({ supabase, runId, viewer, runManagerId, names }: Props) {
  const allowed = viewer.role === "admin" || (viewer.role === "manager" && runManagerId === viewer.userId);
  if (!allowed) return null;
  const { data: records, error } = await supabase
    .from("run_document_values")
    .select("id, kind, fields, confirmed_by, confirmed_at")
    .eq("run_id", runId)
    .order("confirmed_at", { ascending: false });

  return (
    <>
      <section className="flex flex-col gap-2" aria-labelledby="parse-document-title" data-testid="parse-document">
        <h2 id="parse-document-title" className="text-base font-semibold">
          {DOCUMENT_LABELS.title}
        </h2>
        <Card className="gap-4 px-4 py-4">
          <p className="text-sm text-muted-foreground">{DOCUMENT_LABELS.hint}</p>
          <DocumentParsingForm runId={runId} requestAction={requestDocumentValues} confirmAction={confirmDocumentValues} />
        </Card>
      </section>

      {/* Збій читання — не «порожньо»: людина має знати, що історію не завантажено; розбір лишається доступним. */}
      {error ? (
        <Alert variant="destructive" data-testid="document-values-error">
          <AlertDescription>{DOCUMENT_ERRORS.loadFailed}</AlertDescription>
        </Alert>
      ) : null}

      {records?.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{DOCUMENT_LABELS.savedTitle}</h2>
          <Card className="gap-0 py-0">
            <DocumentValuesList
              records={records.map((record) => ({ ...record, confirmedBy: names.get(record.confirmed_by) ?? "—" }))}
            />
          </Card>
        </section>
      ) : null}
    </>
  );
}
