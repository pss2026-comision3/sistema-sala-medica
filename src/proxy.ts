import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_SESION } from "@/lib/auth/constants";

export function proxy(request: NextRequest) {
  const tieneCookie = request.cookies.has(COOKIE_SESION);
  const path = request.nextUrl.pathname;
  const esPublica = path === "/login" || path === "/recuperar";

  if (!tieneCookie && !esPublica) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
