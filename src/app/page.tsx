import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeChoice } from "@/components/ui/theme-choice";
import { OwnAvatar } from "@/components/ui/user-menu";
import { getViewer } from "@/lib/auth/viewer";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { avatarSrc } from "@/lib/profile/avatar";
import { AvatarUpload } from "./avatar-upload";
import { signOut } from "./login/actions";
import { YourWork } from "./your-work";

// Profile (ADR 0012, полотно UI v3): Account — власний email і роль (ролі призначає адміністратор), Preferences — повний
// вибір «Theme» зі словами System · Light · Dark (AC-DSYS-05, AC-DSYS-06; у меню користувача — лише іконки), Sign out.
// getClaims() — у getViewer(); getSession() для авторизації на сервері не використовуємо. RLS: лише власний профіль.
export default async function Profile() {
  const viewer = await getViewer();
  if (!viewer) {
    redirect("/login");
  }
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="text-sm text-muted-foreground">Your account, preferences and the work waiting for you</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="h-11 sm:h-10">
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </form>
      </div>

      <section aria-labelledby="account" className="flex flex-col gap-2">
        <h2 id="account" className="text-base font-semibold">
          Account
        </h2>
        <Card className="flex-col gap-4 px-4 py-4">
          <div className="flex items-center gap-4">
          <OwnAvatar email={viewer.email} src={avatarSrc(viewer.avatarPath)} className="size-14 text-base" />
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium break-all" data-testid="user-email">
              {viewer.email ?? "—"}
            </dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd>
              <span className="font-medium" data-testid="user-role">
                {viewer.role ?? "profile not found"}
              </span>
              <span className="block text-muted-foreground">Roles are set by an administrator.</span>
            </dd>
          </dl>
          </div>
          <AvatarUpload hasPhoto={Boolean(viewer.avatarPath)} />
        </Card>
      </section>

      <section aria-labelledby="preferences" className="flex flex-col gap-2">
        <h2 id="preferences" className="text-base font-semibold">
          Preferences
        </h2>
        <Card className="flex-row flex-wrap items-center justify-between gap-4 px-4 py-4">
          <span className="flex flex-col text-sm">
            <span className="font-medium">Theme</span>
            <span className="text-muted-foreground">Remembered on this device</span>
          </span>
          <ThemeChoice key={theme} value={theme} name="theme-profile" variant="labelled" />
        </Card>
      </section>

      <YourWork supabase={await createClient()} viewer={viewer} />
    </main>
  );
}
