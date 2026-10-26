import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { TextLink } from "@/components/ui/text-link";
import { messageForError, requiredLabel, staffLabel } from "@/lib/runs/domain";
import { LABELS, MESSAGES } from "@/lib/runs/messages";
import { createClient } from "@/lib/supabase/server";
import { parseVersionContent } from "@/lib/templates/version";
import { SubmitButton } from "../submit-button";
import { launchRun } from "./actions";

// Запуск шаблону: спершу вибір шаблону, потім назва випадку і виконавець кожної задачі (за розділами).
// За замовчуванням виконавець — менеджер запуску (AC-RUN-04, AC-RUN-08, AC-RUN-09).
export default async function NewRunPage({ searchParams }: PageProps<"/runs/new">) {
  const { template, error } = await searchParams;
  const templateId = typeof template === "string" ? template : undefined;
  const message = typeof error === "string" ? messageForError(error) : undefined;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }

  // Запускають лише збережені шаблони: задачі — з поточної версії (знімка), а не з незбережених змін
  // (AC-EDITOR-02, AC-EDITOR-06; робоче рішення до solomchaak/property-workflows-spec#21).
  const { data: templates } = await supabase
    .from("templates")
    .select("id, name, current_version")
    .not("current_version", "is", null)
    .order("name");
  const selected = templates?.find((t) => t.id === templateId);

  const [versionResult, staffResult] = selected
    ? await Promise.all([
        supabase
          .from("template_versions")
          .select("content")
          .eq("template_id", selected.id)
          .eq("number", selected.current_version ?? 0)
          .maybeSingle(),
        supabase.rpc("staff_directory"),
      ])
    : [null, null];
  // Знімок не прочитано — форму не показуємо: інакше приховані задачі дісталися б менеджеру запуску мовчки.
  const sections = parseVersionContent(versionResult?.data?.content).sections;
  // Знімок без розділів (невідомий формат) — теж «не прочитано» (рев'ю CodeRabbit, PR #17).
  const versionMissing =
    Boolean(selected) && (Boolean(versionResult?.error) || !versionResult?.data?.content || sections.length === 0);
  const colleagues = (staffResult?.data ?? []).filter((person) => person.id !== claims.sub);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">{LABELS.launchTemplate}</h1>

      <form action="/runs/new" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="template">{LABELS.template}</Label>
          <NativeSelect id="template" name="template" defaultValue={selected?.id ?? ""} required>
            <NativeSelectOption value="" disabled>
              {MESSAGES.templateNotFound}
            </NativeSelectOption>
            {(templates ?? []).map((t) => (
              <NativeSelectOption key={t.id} value={t.id}>
                {t.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">
          {LABELS.choose}
        </Button>
      </form>

      {!selected && message ? (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {selected && versionMissing ? (
        <Alert variant="destructive">
          <AlertDescription>{MESSAGES.templateNotLoaded}</AlertDescription>
        </Alert>
      ) : null}

      {selected && !versionMissing ? (
        <form action={launchRun} className="flex flex-col gap-5">
          <input type="hidden" name="template_id" value={selected.id} />
          <input type="hidden" name="expected_version" value={selected.current_version ?? ""} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="case_name">{LABELS.caseName}</Label>
            <Input
              id="case_name"
              name="case_name"
              type="text"
              placeholder={LABELS.caseNamePlaceholder}
              aria-describedby={message ? "launch-error" : undefined}
            />
          </div>

          {sections.map((section) => (
            <Card key={section.id} className="gap-3 px-4">
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 text-base font-semibold">{section.name}</legend>
                {section.tasks
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <Label htmlFor={`assignee:${task.id}`} className="font-normal">
                        {task.name}{" "}
                        <span className="text-muted-foreground">({requiredLabel(task.is_required)})</span>
                      </Label>
                      <NativeSelect
                        id={`assignee:${task.id}`}
                        name={`assignee:${task.id}`}
                        defaultValue=""
                        aria-label={LABELS.assigneeOf(task.name)}
                      >
                        <NativeSelectOption value="">{LABELS.meAsRunManager}</NativeSelectOption>
                        {colleagues.map((person) => (
                          <NativeSelectOption key={person.id} value={person.id}>
                            {staffLabel(person)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                  ))}
              </fieldset>
            </Card>
          ))}

          {message ? (
            <Alert variant="destructive" id="launch-error">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <SubmitButton label={LABELS.launch} pendingLabel={LABELS.launching} />
          </div>
        </form>
      ) : null}

      <TextLink href="/runs" className="w-fit text-sm">
        {LABELS.backToRuns}
      </TextLink>
    </main>
  );
}
