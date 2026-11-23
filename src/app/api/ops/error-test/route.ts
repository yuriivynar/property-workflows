// WS11, трек B: навмисна помилка сервера, щоб перевірити трекер (onRequestError у src/instrumentation.ts → Telegram).
// Закрито двічі: на проді маршруту немає (404), а на preview і staging він кидає помилку лише адміністратору — інші
// отримують 404, щоб ніхто не засипав чат алертами. Помилка без даних користувача: у чат іде лише назва й стек.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV === "production") return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const admin = await requireAdmin(supabase);
  if (!admin.ok) return new NextResponse(null, { status: 404 });
  throw new Error("ops error test: intentional server error");
}
