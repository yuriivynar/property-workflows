"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// Кнопка неактивна, поки форма відправляється: другий клік не надішле той самий запуск удруге
// (робоче рішення до відповіді на solomchaak/property-workflows-spec#8). Головна дія екрана — Button default (primary).
export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
