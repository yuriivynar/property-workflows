"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Check, CircleAlert, ImageUp, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OwnAvatar } from "@/components/ui/user-menu";
import { cn } from "@/lib/utils";
import { AVATAR_MESSAGES, checkAvatarFile } from "@/lib/profile/avatar";
import { removeAvatar, uploadAvatar, type AvatarResult } from "./avatar/actions";

export const AVATAR_LABELS = {
  change: "Change your photo",
  add: "Add your photo",
  upload: "Upload a photo",
  replace: "Replace photo",
  remove: "Remove photo",
  hint: "PNG or JPG, up to 2 MB. Only you see your photo.",
} as const;

function ResultLine({ result }: { result: AvatarResult | null }) {
  if (!result) return null;
  const Icon = result.ok ? Check : CircleAlert;
  return (
    <span className={cn("flex items-center gap-1.5", result.ok ? "text-foreground" : "text-destructive")} role={result.ok ? undefined : "alert"}>
      <Icon aria-hidden="true" className="size-4" />
      {result.message}
    </span>
  );
}

/**
 * Фото профілю (UI v3, рішення власника 2026-11-26, ADR 0012): клік по аватару відкриває меню «Upload a photo» /
 * «Replace photo» і «Remove photo»; файл можна й перетягнути на аватар. Збережене фото одразу видно — через
 * /api/avatar, без blob-URL файлу користувача. PNG/JPG до 2 МБ; фото бачить лише сам користувач, іншим — лише email.
 * Перевірка у браузері — та сама, що в дії (checkAvatarFile); остаточно — дія й бакет.
 */
export function AvatarUpload({ email, src, hasPhoto }: { email: string | null; src: string | null; hasPhoto: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<AvatarResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();

  function send(file: File | undefined) {
    const check = checkAvatarFile(file);
    if (!check.ok || !file) {
      setResult({ ok: false, message: check.ok ? AVATAR_MESSAGES.wrongType : check.message });
      return;
    }
    const data = new FormData();
    data.set("photo", file);
    startTransition(async () => setResult(await uploadAvatar(data)));
  }

  function remove() {
    startTransition(async () => setResult(await removeAvatar()));
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid="avatar-menu"
          aria-label={hasPhoto ? AVATAR_LABELS.change : AVATAR_LABELS.add}
          aria-busy={pending || undefined}
          disabled={pending}
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
            "group/avatar relative cursor-pointer rounded-full outline-none transition-[box-shadow] duration-(--duration-fast) hover:ring-4 hover:ring-glow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-popup-open:ring-4 data-popup-open:ring-glow",
            dragging && "ring-4 ring-ring",
            pending && "opacity-60",
          )}
        >
          <OwnAvatar email={email} src={src} className="size-16 text-base" />
          <span className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border-2 border-card bg-secondary text-foreground">
            <Camera aria-hidden="true" className="size-3.5" />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">{AVATAR_LABELS.hint}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => input.current?.click()}>
              <ImageUp aria-hidden="true" />
              {hasPhoto ? AVATAR_LABELS.replace : AVATAR_LABELS.upload}
            </DropdownMenuItem>
            {hasPhoto ? (
              <DropdownMenuItem variant="destructive" onClick={remove}>
                <Trash2 aria-hidden="true" />
                {AVATAR_LABELS.remove}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={input}
        type="file"
        name="photo"
        accept="image/png,image/jpeg"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          send(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <span className="text-sm" aria-live="polite">
        <ResultLine result={result} />
      </span>
    </div>
  );
}
