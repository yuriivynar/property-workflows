import { Notice } from "@/components/ui/notice";
import { refusalBackLink, TEMPLATE_MESSAGES } from "@/lib/templates/domain";

// Відмова «Not enough rights» у тому самому макеті, без жодних даних (AC-DSYS-02, AC-EDITOR-07): посилання назад — за
// роллю (refusalBackLink): вендору «Back to runs» (AC-VENDOR-08, AC-VENDOR-14), іншим «Back to templates».
export function NotEnoughRights({ role }: { role: string | null | undefined }) {
  const back = refusalBackLink(role);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Notice message={TEMPLATE_MESSAGES.notEnoughRights} backHref={back.href} backLabel={back.label} />
    </main>
  );
}
