import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { parseTheme, THEME_COOKIE, themeAttribute } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Property workflows",
  description: "Templates, runs and tasks of a property management agency",
};

// Спільний макет (PageShell) — однаковий для всіх сторінок, зокрема входу (AC-DSYS-02, AC-DSYS-03). Навігацію
// показуємо лише після входу; getClaims() тут лише для вигляду, права перевіряє кожна сторінка й дія.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  // Обрана тема — з cookie ще до першого малювання; без вибору — за пристроєм (ADR 0004; AC-DSYS-05, AC-DSYS-06).
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={themeAttribute(theme)}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PageShell signedIn={signedIn} theme={theme}>{children}</PageShell>
      </body>
    </html>
  );
}
