import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeChoice } from "@/components/ui/theme-choice";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
const ROLE_HINT = "Roles are set by an administrator.";

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
        <Card className="flex-row flex-wrap items-start gap-5 px-4 py-4">
          {/* Клік по аватару — меню «Replace photo» / «Remove photo» (рішення власника 2026-11-26, ADR 0012). */}
          <AvatarUpload email={viewer.email} src={avatarSrc(viewer.avatarPath)} hasPhoto={Boolean(viewer.avatarPath)} />
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 pt-2 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium break-all" data-testid="user-email">
              {viewer.email ?? "—"}
            </dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd>
              {/* «Roles are set by an administrator.» — підказка при наведенні чи фокусі, а не рядок постійно. */}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      tabIndex={0}
                      aria-describedby="role-hint"
                      className="cursor-help rounded-sm font-medium underline decoration-muted-foreground decoration-dotted underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-ring"
                      data-testid="user-role"
                    />
                  }
                >
                  {viewer.role ?? "profile not found"}
                </TooltipTrigger>
                <TooltipContent>{ROLE_HINT}</TooltipContent>
              </Tooltip>
              <span id="role-hint" className="sr-only">
                {ROLE_HINT}
              </span>
            </dd>
          </dl>
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
