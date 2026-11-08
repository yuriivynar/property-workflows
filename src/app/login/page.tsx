import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthHero } from "@/components/ui/auth-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "./actions";

// Інтерфейс англійською (вимоги PM, «Припущення»); вигляд — лише компоненти @/components/ui і токени DESIGN.md.
const ERRORS: Record<string, string> = {
  missing: "Enter your email and password.",
  invalid: "The email or password is not correct.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[1.1fr_1fr]">
      <AuthHero className="hidden lg:grid" />
      <Card className="mx-auto w-full max-w-sm self-center [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
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
            <Button type="submit" size="lg" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
