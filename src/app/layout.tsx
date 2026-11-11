import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
import { parseTheme, THEME_COOKIE, themeAttribute } from "@/lib/theme";
import "./globals.css";

// IBM Plex Sans — шрифт інтерфейсу (ADR 0007): ділове, чітке накреслення з цифрами однакової ширини.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
  const claims = data?.claims;
  const signedIn = Boolean(claims);
  // Пункти навігації — за роллю (navItems): вендору лише «Runs» і «Profile» (AC-VENDOR-13; solomchaak/property-workflows-spec#44).
  const { data: profile } = claims
    ? await supabase.from("profiles").select("role").eq("id", claims.sub).maybeSingle()
    : { data: null };
  // Обрана тема — з cookie ще до першого малювання; без вибору — за пристроєм (ADR 0004; AC-DSYS-05, AC-DSYS-06).
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={themeAttribute(theme)}
      className={`${plexSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PageShell signedIn={signedIn} role={profile?.role} email={typeof claims?.email === "string" ? claims.email : null} theme={theme}>{children}</PageShell>
      </body>
    </html>
  );
}
