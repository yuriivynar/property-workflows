"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { productModel } from "@/lib/ai/openrouter";
import { currentUser } from "@/lib/auth/require-role";
import type { ParseState, SaveState } from "@/lib/documents/form";
import { confirmValues, requestValues } from "@/lib/documents/service";
import { createClient } from "@/lib/supabase/server";

// AI-розбір документа в запуску (openspec/specs/document-parsing). Кожна дія спершу перевіряє вхід (getClaims()) і роль
// з profiles (currentUser), а вже потім сервіс вирішує, чи це адміністратор або менеджер запуску, — до виклику моделі
// й до запису (src/lib/documents/service.ts). Ключ моделі — лише в src/lib/ai/openrouter.ts (server-only).

/** «Parse document» — пропозиція моделі; нічого не пише (AC-DOCAI-08). */
export async function requestDocumentValues(_previous: ParseState, formData: FormData): Promise<ParseState> {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok && user.reason === "NOT_SIGNED_IN") redirect("/login");
  return requestValues({ supabase, user, model: productModel() }, formData);
}

/** «Save values» — єдина дія, що пише значення документа (AC-DOCAI-08). */
export async function confirmDocumentValues(_previous: SaveState, formData: FormData): Promise<SaveState> {
  const supabase = await createClient();
  const user = await currentUser(supabase);
  if (!user.ok && user.reason === "NOT_SIGNED_IN") redirect("/login");
  const result = await confirmValues({ supabase, user }, formData);
  if (result.status === "saved") revalidatePath(`/runs/${String(formData.get("run_id"))}`);
  return result;
}
