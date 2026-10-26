// Route protection. Live mode: Supabase session (refreshed here). Demo mode: explicit demo cookie.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getServerConfig } from "@/lib/config";

const PROTECTED = ["/dashboard", "/materials", "/topics", "/quiz", "/gap-report", "/revision-plan", "/progress", "/tutor", "/settings"];
const AUTH_PAGES = ["/login", "/register"];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  const config = getServerConfig();

  if (config.mode === "demo") {
    const inDemo = req.cookies.get("gf_demo")?.value === "1";
    if (isProtected && !inDemo) return redirectTo(req, "/login", path);
    return NextResponse.next();
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(config.supabase!.url, config.supabase!.anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  if (isProtected && !data.user) return redirectTo(req, "/login", path);
  if (AUTH_PAGES.includes(path) && data.user) return NextResponse.redirect(new URL("/dashboard", req.url));
  return res;
}

function redirectTo(req: NextRequest, to: string, next: string) {
  const url = new URL(to, req.url);
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
