"use client";

import { startTransition, useActionState, useId, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PendingButton } from "@/components/ui/pending-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, URGENCIES } from "@/lib/ai/schema";
import {
  DOCUMENT_LABELS,
  INITIAL_PARSE_STATE,
  INITIAL_SAVE_STATE,
  emptyView,
  type ParseState,
  type SaveState,
} from "@/lib/documents/form";
import { DOCUMENT_MESSAGES, totalWarning, type ProposalView } from "@/lib/documents/values";

type Action<S> = (state: S, formData: FormData) => Promise<S>;

type Props = {
  runId: string;
  requestAction: Action<ParseState>;
  confirmAction: Action<SaveState>;
};

/**
 * Блок «Parse a document» (openspec/changes/impl-document-parsing/design.md, «UI»): людина вставляє текст, просить
 * розібрати, бачить і виправляє значення й лише тоді натискає «Save values» — єдину дію, що пише (AC-DOCAI-08).
 * Відмова — текст без значень (AC-DOCAI-07); помічник недоступний — текст і порожня форма для ручного вводу (AC-DOCAI-09).
 */
export function DocumentParsingForm({ runId, requestAction, confirmAction }: Props) {
  const [parse, parseAction, parsing] = useActionState(requestAction, INITIAL_PARSE_STATE);
  // Кожен новий розбір — нова форма значень (React key), щоб не змішати старі виправлення з новою пропозицією.
  const [round, setRound] = useState(0);
  const textId = useId();

  const values =
    parse.status === "proposed"
      ? { view: parse.view, fromProposal: true }
      : parse.status === "unavailable"
        ? { view: emptyView(), fromProposal: false }
        : null;

  return (
    <div className="flex flex-col gap-4">
      <form action={parseAction} onSubmit={() => setRound((n) => n + 1)} className="flex flex-col gap-4">
        <input type="hidden" name="run_id" value={runId} />
        <div className="flex flex-col gap-2">
          <Label htmlFor={textId}>{DOCUMENT_LABELS.documentText}</Label>
          <Textarea id={textId} name="document_text" defaultValue={parse.text} key={`text-${round}`} required />
        </div>
        <div>
          <PendingButton variant="secondary" className="max-sm:w-full">
            {DOCUMENT_LABELS.parse}
          </PendingButton>
        </div>
      </form>

      {parse.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{parse.message}</AlertDescription>
        </Alert>
      ) : null}
      {parse.status === "refused" || parse.status === "unavailable" ? (
        <Alert data-testid="document-notice">
          <AlertDescription>{parse.message}</AlertDescription>
        </Alert>
      ) : null}

      {/* Під час нового розбору стару форму ховаємо: вона розмонтовується, і нова пропозиція не змішується зі станом
          попередньої (і стару не можна зберегти, поки йде розбір). */}
      {parsing ? <ParsingPlaceholder /> : null}

      {values && !parsing ? (
        <ValuesForm
          key={`values-${round}`}
          runId={runId}
          view={values.view}
          fromProposal={values.fromProposal}
          confirmAction={confirmAction}
        />
      ) : null}
    </div>
  );
}

type ProposedView = Extract<ProposalView, { state: "proposed" }>;
type ItemDraft = { name: string; quantity: string; unitPrice: string };

const toDraft = (view: ProposedView): ItemDraft[] =>
  view.items.length
    ? view.items.map((item) => ({ name: item.name, quantity: String(item.quantity), unitPrice: String(item.unitPrice) }))
    : [{ name: "", quantity: "", unitPrice: "" }];

const parseNumber = (value: string) => (value.trim() ? Number(value.trim().replace(",", ".")) : Number.NaN);

/** Попередження про суму на льоту з того, що зараз у полях (те саме правило коду, що й на сервері, AC-DOCAI-06). */
function liveWarning(items: ItemDraft[], total: string): string | null {
  const parsed = items
    .filter((item) => item.name.trim() || item.quantity.trim() || item.unitPrice.trim())
    .map((item) => ({ name: item.name, quantity: parseNumber(item.quantity), unitPrice: parseNumber(item.unitPrice) }));
  const totalValue = parseNumber(total);
  if (!parsed.length || Number.isNaN(totalValue) || parsed.some((i) => Number.isNaN(i.quantity) || Number.isNaN(i.unitPrice))) {
    return null;
  }
  return totalWarning(parsed, totalValue);
}

function NotFound({ show }: { show: boolean }) {
  return show ? <span className="text-sm font-normal text-muted-foreground"> — {DOCUMENT_MESSAGES.notFound}</span> : null;
}

type Missing = (value: unknown) => boolean;
type RequestDraft = { phone: string; description: string; category: string; urgency: string };

function ValuesForm({
  runId,
  view,
  fromProposal,
  confirmAction,
}: {
  runId: string;
  view: ProposedView;
  fromProposal: boolean;
  confirmAction: Action<SaveState>;
}) {
  const [save, saveAction, saving] = useActionState(confirmAction, INITIAL_SAVE_STATE);
  const [kind, setKind] = useState<"request" | "estimate">(view.kind);
  // Позиції й сума живуть тут, а не в EstimateFields: перемикання типу документа не стирає вже введене.
  const [items, setItems] = useState<ItemDraft[]>(() => toDraft(view));
  const [total, setTotal] = useState(view.total === null ? "" : String(view.total));
  // Поля звернення керовані: React скидає некеровані поля форми після кожної дії, зокрема після помилки збереження,
  // і виправлення людини повернулися б до пропозиції моделі.
  const [request, setRequest] = useState<RequestDraft>(() => ({
    phone: view.phone ?? "",
    description: view.description ?? "",
    category: view.category ?? "",
    urgency: view.urgency ?? "",
  }));
  const id = useId();
  // Не <form action>: після дії React скидає форму (form.reset()), і керовані <select> (тип, category, urgency) втратили б
  // вибір людини навіть після помилки збереження. Надсилаємо самі — без скидання.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => saveAction(data));
  };
  // «not found» — лише біля поля, яке модель не знайшла в документі (AC-DOCAI-02), не в ручному вводі.
  const missing: Missing = (value) => fromProposal && (value === null || value === "");

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 border-t border-border pt-4" data-testid="document-values-form">
      <input type="hidden" name="run_id" value={runId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-kind`}>{DOCUMENT_LABELS.kind}</Label>
        <NativeSelect
          id={`${id}-kind`}
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value === "estimate" ? "estimate" : "request")}
        >
          <NativeSelectOption value="request">{DOCUMENT_LABELS.request}</NativeSelectOption>
          <NativeSelectOption value="estimate">{DOCUMENT_LABELS.estimate}</NativeSelectOption>
        </NativeSelect>
      </div>

      {kind === "request" ? (
        <RequestFields
          id={id}
          view={view}
          missing={missing}
          values={request}
          onChange={(patch) => setRequest((current) => ({ ...current, ...patch }))}
        />
      ) : (
        <EstimateFields
          id={id}
          items={items}
          setItems={setItems}
          total={total}
          setTotal={setTotal}
          totalMissing={missing(view.total)}
        />
      )}

      <NotesList notes={view.notes} />
      <SaveRow save={save} saving={saving} />
    </form>
  );
}

function RequestFields({
  id,
  view,
  missing,
  values,
  onChange,
}: {
  id: string;
  view: ProposedView;
  missing: Missing;
  values: RequestDraft;
  onChange: (patch: Partial<RequestDraft>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-phone`}>
          {DOCUMENT_LABELS.phone}
          <NotFound show={missing(view.phone)} />
        </Label>
        <Input
          id={`${id}-phone`}
          name="phone"
          value={values.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          inputMode="tel"
        />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor={`${id}-description`}>
          {DOCUMENT_LABELS.description}
          <NotFound show={missing(view.description)} />
        </Label>
        <Input
          id={`${id}-description`}
          name="description"
          value={values.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </div>
      <ChoiceField
        id={`${id}-category`}
        name="category"
        label={DOCUMENT_LABELS.category}
        options={CATEGORIES}
        value={values.category}
        onChange={(category) => onChange({ category })}
        missing={missing(view.category)}
      />
      <ChoiceField
        id={`${id}-urgency`}
        name="urgency"
        label={DOCUMENT_LABELS.urgency}
        options={URGENCIES}
        value={values.urgency}
        onChange={(urgency) => onChange({ urgency })}
        missing={missing(view.urgency)}
      />
    </div>
  );
}

function ChoiceField({
  id,
  name,
  label,
  options,
  value,
  onChange,
  missing,
}: {
  id: string;
  name: string;
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  missing: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        <NotFound show={missing} />
      </Label>
      <NativeSelect id={id} name={name} value={value} onChange={(event) => onChange(event.target.value)} className="w-full">
        <NativeSelectOption value="">{DOCUMENT_LABELS.choose}</NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

function EstimateFields({
  id,
  items,
  setItems,
  total,
  setTotal,
  totalMissing,
}: {
  id: string;
  items: ItemDraft[];
  setItems: Dispatch<SetStateAction<ItemDraft[]>>;
  total: string;
  setTotal: (value: string) => void;
  totalMissing: boolean;
}) {
  const warning = liveWarning(items, total);
  const updateItem = (index: number, patch: Partial<ItemDraft>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-sm font-medium">{DOCUMENT_LABELS.items}</legend>
      {items.map((item, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_auto] sm:items-end" data-testid="document-item">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-item-${index}`}>{DOCUMENT_LABELS.item}</Label>
            <Input
              id={`${id}-item-${index}`}
              name="item_name"
              value={item.name}
              onChange={(event) => updateItem(index, { name: event.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-qty-${index}`}>{DOCUMENT_LABELS.quantity}</Label>
            <Input
              id={`${id}-qty-${index}`}
              name={`item_quantity_${index}`}
              inputMode="decimal"
              className="tabular-nums"
              value={item.quantity}
              onChange={(event) => updateItem(index, { quantity: event.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${id}-price-${index}`}>{DOCUMENT_LABELS.unitPrice}</Label>
            <Input
              id={`${id}-price-${index}`}
              name={`item_unit_price_${index}`}
              inputMode="decimal"
              className="tabular-nums"
              value={item.unitPrice}
              onChange={(event) => updateItem(index, { unitPrice: event.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={items.length === 1}
            onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
          >
            {DOCUMENT_LABELS.removeItem}
          </Button>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setItems((current) => [...current, { name: "", quantity: "", unitPrice: "" }])}
        >
          {DOCUMENT_LABELS.addItem}
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:max-w-48">
        <Label htmlFor={`${id}-total`}>
          {DOCUMENT_LABELS.total}
          <NotFound show={totalMissing} />
        </Label>
        <Input
          id={`${id}-total`}
          name="total"
          inputMode="decimal"
          className="tabular-nums"
          value={total}
          onChange={(event) => setTotal(event.target.value)}
        />
      </div>
      {warning ? (
        <Alert data-testid="document-warning">
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ) : null}
    </fieldset>
  );
}

function NotesList({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{DOCUMENT_LABELS.notes}</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm" data-testid="document-notes">
        {notes.map((note) => (
          <li key={note}>
            {note}
            <input type="hidden" name="notes" value={note} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Поки модель читає документ (зазвичай 5–30 с): заглушка у формі майбутньої форми значень (Skeleton, як у loading.tsx)
 * і короткий текст стану — людина бачить, що розбір іде і скільки приблизно чекати.
 */
function ParsingPlaceholder() {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4" data-testid="document-parsing">
      <p role="status" className="text-sm text-muted-foreground">
        {DOCUMENT_LABELS.parsing}
      </p>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-11 w-full sm:h-10 sm:max-w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className={index === 1 ? "flex flex-col gap-2 sm:col-span-2" : "flex flex-col gap-2"}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full sm:h-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveRow({ save, saving }: { save: SaveState; saving: boolean }) {
  return (
    <>
      {save.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{save.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <PendingButton pending={saving} className="max-sm:w-full">
          {DOCUMENT_LABELS.save}
        </PendingButton>
        {save.status === "saved" ? (
          <p role="status" className="text-sm text-muted-foreground">
            {save.message}
          </p>
        ) : null}
      </div>
    </>
  );
}
