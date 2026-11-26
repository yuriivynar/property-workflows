import { StatusBadge } from "@/components/ui/status-badge";
import { TextLink } from "@/components/ui/text-link";
import { formatVersionDate, TEMPLATE_MESSAGES, versionSummary } from "@/lib/templates/domain";

// Частини списку шаблонів (UI v3, рішення власника 2026-11-26, ADR 0012): картка шаблону (створення — create-template-dialog.tsx).

export interface SavedVersion {
  template_id: string;
  number: number;
  content: unknown;
  created_by: string | null;
  created_at: string;
}

function VersionDetails({ version, emails }: { version: SavedVersion | undefined; emails: Map<string, string | null> }) {
  if (!version) return <p className="text-sm text-muted-foreground">{TEMPLATE_MESSAGES.saveToLaunch}</p>;
  const summary = versionSummary(version.content);
  const author = version.created_by ? (emails.get(version.created_by) ?? null) : null;
  return (
    <>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{summary.sections}</span> sections
        </span>
        <span>
          <span className="font-semibold text-foreground">{summary.tasks}</span> tasks
        </span>
        <span>
          <span className="font-semibold text-foreground">{summary.required}</span> required
        </span>
      </p>
      <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
        {TEMPLATE_MESSAGES.savedBy(formatVersionDate(version.created_at), author)}
      </p>
    </>
  );
}

/** Картка шаблону: назва, стан версії, «Unpublished changes» (admin), лічильники й «Saved … by …», Edit / Versions. */
export function TemplateCard({
  template,
  version,
  unpublished,
  isAdmin,
  emails,
}: {
  template: { id: string; name: string; current_version: number | null };
  version: SavedVersion | undefined;
  unpublished: boolean;
  isAdmin: boolean;
  emails: Map<string, string | null>;
}) {
  return (
    <li
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
      {unpublished ? (
        <span>
          <StatusBadge status="unpublished" />
        </span>
      ) : null}
      <VersionDetails version={version} emails={emails} />
      {isAdmin ? (
        <div className="relative z-10 mt-auto flex gap-4 border-t border-border pt-3 text-sm">
          <TextLink href={`/templates/${template.id}/edit`} className="font-medium no-underline hover:underline">
            Edit
          </TextLink>
          <TextLink href={`/templates/${template.id}/versions`} className="font-medium no-underline hover:underline">
            Versions
          </TextLink>
        </div>
      ) : null}
    </li>
  );
}
