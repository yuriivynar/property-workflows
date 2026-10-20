"use client";

import { useFormStatus } from "react-dom";

// Кнопка неактивна, поки форма відправляється: другий клік не надішле той самий запуск удруге
// (робоче рішення до відповіді на solomchaak/property-workflows-spec#8).
export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
