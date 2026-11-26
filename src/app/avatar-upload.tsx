"use client";

import { useRef, useState, useTransition } from "react";
import { Check, CircleAlert, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AVATAR_MESSAGES, checkAvatarFile } from "@/lib/profile/avatar";
import { removeAvatar, uploadAvatar } from "./avatar/actions";

/**
 * Фото профілю (UI v3, рішення власника 2026-11-26, ADR 0012): перетягнути файл або обрати його, попередній перегляд,
 * PNG/JPG до 2 МБ, «Remove photo». Фото бачить лише сам користувач; іншим людям — лише email.
 * Перевірка у браузері — та сама, що в дії (checkAvatarFile); остаточно — дія й бакет.
 */
export function AvatarUpload({ hasPhoto }: { hasPhoto: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function send(file: File | undefined) {
    const check = checkAvatarFile(file);
    if (!check.ok || !file) {
      setResult({ ok: false, message: check.ok ? AVATAR_MESSAGES.wrongType : check.message });
      return;
    }
    setPreview(URL.createObjectURL(file));
    const data = new FormData();
    data.set("photo", file);
    startTransition(async () => setResult(await uploadAvatar(data)));
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          send(event.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input px-4 py-3 text-sm transition-colors duration-(--duration-fast) hover:bg-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
          dragging && "border-foreground bg-accent",
        )}
      >
        {preview ? (
          // Попередній перегляд — blob: з img-src CSP; alt порожній, бо поруч є підпис.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <ImageUp aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        )}
        <span className="flex flex-col">
          <span className="font-medium">
            {dragging ? "Drop to upload" : hasPhoto ? "Replace your photo" : "Drag a photo here or choose a file"}
          </span>
          <span className="text-muted-foreground">PNG or JPG, up to 2 MB. Only you see your photo.</span>
        </span>
        <input
          ref={input}
          type="file"
          name="photo"
          accept="image/png,image/jpeg"
          className="sr-only"
          aria-busy={pending || undefined}
          onChange={(event) => send(event.target.files?.[0])}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 text-sm" aria-live="polite">
        {result ? (
          <span className={cn("flex items-center gap-1.5", result.ok ? "text-foreground" : "text-destructive")} role={result.ok ? undefined : "alert"}>
            {result.ok ? <Check aria-hidden="true" className="size-4" /> : <CircleAlert aria-hidden="true" className="size-4" />}
            {result.message}
          </span>
        ) : null}
        {hasPhoto ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setPreview(null);
                setResult(await removeAvatar());
              })
            }
          >
            Remove photo
          </Button>
        ) : null}
      </div>
    </div>
  );
}
