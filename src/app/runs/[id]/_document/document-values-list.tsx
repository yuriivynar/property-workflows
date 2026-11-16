import { DOCUMENT_LABELS, formatConfirmedAt } from "@/lib/documents/form";
import { ConfirmedValuesSchema, toStoredValues } from "@/lib/documents/values";

export type SavedDocumentValues = {
  id: string;
  kind: string;
  fields: unknown;
  confirmed_at: string;
  confirmedBy: string;
};

/**
 * Розділ «Document values»: значення, які людина підтвердила кнопкою «Save values» (AC-DOCAI-08), найновіші вгорі — тип,
 * значення, хто підтвердив і коли (за Києвом). Рядок, що не відповідає схемі, не показуємо як значення.
 */
export function DocumentValuesList({ records }: { records: SavedDocumentValues[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border" data-testid="document-values">
      {records.map((record) => {
        const parsed = ConfirmedValuesSchema.safeParse({ ...(record.fields as object), kind: record.kind });
        if (!parsed.success) return null;
        const values = toStoredValues(parsed.data);
        return (
          <li key={record.id} className="flex flex-col gap-2 px-4 py-3.5 text-sm" data-testid="document-values-record">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
              <span className="font-medium">
                {values.kind === "request" ? DOCUMENT_LABELS.request : DOCUMENT_LABELS.estimate}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {DOCUMENT_LABELS.confirmedBy} {record.confirmedBy} · {formatConfirmedAt(record.confirmed_at)}
              </span>
            </div>
            {values.kind === "request" ? (
              <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[8rem_minmax(0,1fr)]">
                <dt className="text-muted-foreground">{DOCUMENT_LABELS.phone}</dt>
                <dd>{values.phone ?? "—"}</dd>
                <dt className="text-muted-foreground">{DOCUMENT_LABELS.description}</dt>
                <dd className="[overflow-wrap:anywhere]">{values.description}</dd>
                <dt className="text-muted-foreground">{DOCUMENT_LABELS.category}</dt>
                <dd>{values.category}</dd>
                <dt className="text-muted-foreground">{DOCUMENT_LABELS.urgency}</dt>
                <dd>{values.urgency}</dd>
              </dl>
            ) : (
              <div className="flex flex-col gap-1">
                <ul className="flex flex-col gap-0.5 tabular-nums">
                  {values.items.map((item, index) => (
                    <li key={index} className="[overflow-wrap:anywhere]">
                      {item.name} — {item.quantity} × {item.unitPrice.toFixed(2)}
                    </li>
                  ))}
                </ul>
                <p className="tabular-nums">
                  <span className="text-muted-foreground">{DOCUMENT_LABELS.total}</span>{" "}
                  {values.total === null ? "—" : values.total.toFixed(2)}
                </p>
                {values.warning ? <p className="text-muted-foreground">{values.warning}</p> : null}
              </div>
            )}
            {values.notes.length ? (
              <ul className="flex list-disc flex-col gap-0.5 pl-5 text-muted-foreground">
                {values.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
