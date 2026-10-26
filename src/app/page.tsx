import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { LABELS } from "@/lib/runs/messages";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

// Головна сторінка шаблону: хто увійшов і з якою роллю (з таблиці profiles).
// Сторінка читає cookies, тому рендериться динамічно (шаблон зібрано з --no-cache-components).
export default async function Home() {
  const supabase = await createClient();

  // getClaims() перевіряє JWT. getSession() для авторизації на сервері не використовуємо.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/login");
  }

  // RLS: користувач бачить лише власний профіль.
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", claims.sub)
    .maybeSingle();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd data-testid="user-email">{profile?.email ?? claims.email ?? "—"}</dd>
        <dt className="text-muted-foreground">Role</dt>
        <dd data-testid="user-role">{profile?.role ?? "profile not found"}</dd>
      </dl>
      <TextLink href="/runs" className="w-fit text-sm" data-testid="runs-link">
        {LABELS.runsTitle}
      </TextLink>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}
