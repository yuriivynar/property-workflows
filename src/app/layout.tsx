import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PageShell } from "@/components/ui/page-shell";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PageShell signedIn={signedIn}>{children}</PageShell>
      </body>
    </html>
  );
}
