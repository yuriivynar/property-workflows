// Next.js 16: proxy.ts замість middleware.ts. З --src-dir файл МАЄ лежати в src/,
// інакше його мовчки ігнорують. Перевірка: `npm run build` показує «ƒ Proxy (Middleware)».
import { type NextRequest } from "next/server";
import { contentSecurityPolicy, newNonce } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // CSP з nonce: Next.js читає nonce із заголовка ЗАПИТУ (ставить його на свої скрипти під час рендеру), а браузер
  // отримує той самий заголовок у ВІДПОВІДІ. Заголовки запиту змінюємо до updateSession: вона будує відповідь
  // через NextResponse.next({ request }) і передає їх далі.
  const nonce = newNonce();
  const csp = contentSecurityPolicy({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    isDev: process.env.NODE_ENV === "development",
  });
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  const response = await updateSession(request);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    // Усі шляхи, крім статики Next.js, favicon і зображень.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
