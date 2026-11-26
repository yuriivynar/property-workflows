import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthHero } from "@/components/ui/auth-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingButton } from "@/components/ui/pending-button";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/access";
import { landingPath } from "@/lib/auth/landing";
import { createClient } from "@/lib/supabase/server";
import { login } from "./actions";
import { loginErrorMessage } from "@/lib/auth/login-errors";

// Інтерфейс англійською (вимоги PM, «Припущення»); вигляд — лише компоненти @/components/ui і токени DESIGN.md.

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next } = await searchParams;
  // Уже увійшов — форма входу не потрібна: туди, куди вело посилання, або на свою першу сторінку. Інакше форма
  // показувалась би всередині макета з навігацією того, хто вже увійшов.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (userId) redirect(await landingPath(supabase, userId, safeNextPath(next)));

  const message = loginErrorMessage(error);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-6 sm:px-6 sm:py-10">
      {/* Панель і форма — дві половини однієї картки: однакова висота (ADR 0008). На вузьких екранах — лише форма. */}
      <Card className="mx-auto w-full max-w-sm gap-0 rounded-3xl py-0 lg:grid lg:max-w-none lg:grid-cols-[1.1fr_1fr]">
        <AuthHero className="hidden lg:block" />
        <div className="flex flex-col justify-center gap-6 py-8 [--card-spacing:--spacing(6)] sm:py-12 sm:[--card-spacing:--spacing(10)]">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold">Sign in</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={login} className="flex flex-col gap-4">
            {typeof next === "string" ? <input type="hidden" name="next" value={next} /> : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                aria-describedby={message ? "login-error" : undefined}
              />
            </div>
            {message ? (
              <Alert variant="destructive" id="login-error">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}
            <PendingButton size="lg" className="w-full">
              Sign in
            </PendingButton>
          </form>
        </CardContent>
        </div>
      </Card>
    </main>
  );
}
