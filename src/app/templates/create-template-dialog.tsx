"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingButton } from "@/components/ui/pending-button";
import { messageForTemplateError, TEMPLATE_MESSAGES } from "@/lib/templates/domain";
import { createTemplate } from "./actions";

/**
 * Створення шаблону (лише admin; рішення власника 2026-11-26, ADR 0012): головна дія сторінки — кнопка «New template»,
 * яка відкриває вікно з полем «Template name» і «Create a template». Поле в шапці сторінки плутали з пошуком.
 * noValidate: порожню назву перевіряє дія й показує «Enter a template name» (AC-EDITOR-19) під полем, а «A template with
 * this name already exists» (AC-EDITOR-23) — теж там; з помилкою (адреса ?error=…) чи з ?new=1 вікно відкрите одразу.
 */
export function CreateTemplateDialog({ error, open }: { error: string | undefined; open: boolean }) {
  return (
    <Dialog defaultOpen={open}>
      <DialogTrigger render={<Button size="lg" className="max-sm:w-full" />}>
        <Plus aria-hidden="true" />
        {TEMPLATE_MESSAGES.newTemplate}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TEMPLATE_MESSAGES.newTemplate}</DialogTitle>
          <DialogDescription>{TEMPLATE_MESSAGES.newTemplateHint}</DialogDescription>
        </DialogHeader>
        <form action={createTemplate} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-template-name">Template name</Label>
            <Input
              id="new-template-name"
              name="name"
              required
              autoFocus
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? "template-error" : undefined}
            />
            {error ? (
              <FieldError id="template-error" fieldId="new-template-name">
                {messageForTemplateError(error)}
              </FieldError>
            ) : null}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>{TEMPLATE_MESSAGES.cancel}</DialogClose>
            <PendingButton>{TEMPLATE_MESSAGES.createTemplate}</PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
