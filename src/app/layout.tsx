import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { PageShell } from "@/components/ui/page-shell";
import { getViewer } from "@/lib/auth/viewer";
import { avatarSrc } from "@/lib/profile/avatar";
import { parseTheme, THEME_COOKIE, themeAttribute } from "@/lib/theme";
import { parseSidebar, parseSidebarWidth, SIDEBAR_COOKIE, SIDEBAR_WIDTH_COOKIE } from "@/lib/sidebar";
import { signOut } from "./login/actions";
import { searchIndex } from "./search/actions";
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
  // Один getViewer() на рендер (React cache): той самий результат беруть сторінки (ADR 0012).
  const viewer = await getViewer();
  // Пункти навігації — за роллю (navItems): вендору лише «Runs» і «Profile» (AC-VENDOR-13; solomchaak/property-workflows-spec#44).
  // Обрана тема — з cookie ще до першого малювання; без вибору — за пристроєм (ADR 0004; AC-DSYS-05, AC-DSYS-06).
  const store = await cookies();
  const theme = parseTheme(store.get(THEME_COOKIE)?.value);
  // Бічна панель — розгорнута чи згорнута, і її ширина (рішення власника 2026-11-26, ADR 0012): теж із cookie, без стрибка.
  const sidebar = parseSidebar(store.get(SIDEBAR_COOKIE)?.value);
  const sidebarWidth = parseSidebarWidth(store.get(SIDEBAR_WIDTH_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={themeAttribute(theme)}
      className={`${plexSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PageShell signedIn={Boolean(viewer)} role={viewer?.role} email={viewer?.email} theme={theme} sidebar={sidebar} sidebarWidth={sidebarWidth} signOut={signOut} avatarSrc={avatarSrc(viewer?.avatarPath)} search={searchIndex}>{children}</PageShell>
      </body>
    </html>
  );
}
