/**
 * Erneuert die Supabase-Sitzung bei jedem Aufruf und stellt alles hinter
 * die Anmeldung, was nicht ausdruecklich offen ist.
 *
 * Die Rollenpruefung steckt NICHT hier, sondern in den Seiten und
 * Serveraktionen - und die eigentliche Absicherung liegt in der
 * Zeilensicherheit der Datenbank. Diese Middleware ist nur die Tuer,
 * nicht das Schloss.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Seiten, die ohne Anmeldung erreichbar sein muessen. */
const OFFEN = ["/anmelden", "/passwort-setzen", "/auth"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Ohne Zugangsdaten keine Anmeldepflicht - sonst waere die App in einer
  // halb eingerichteten Umgebung vollstaendig unbenutzbar.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(liste) {
        for (const { name, value } of liste) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of liste) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser, nicht getSession: nur getUser prueft das Token serverseitig.
  const { data } = await supabase.auth.getUser();

  const pfad = request.nextUrl.pathname;
  const istOffen = OFFEN.some((p) => pfad === p || pfad.startsWith(p + "/"));

  if (!data.user && !istOffen) {
    const ziel = request.nextUrl.clone();
    ziel.pathname = "/anmelden";
    // Nach der Anmeldung dorthin zurueck, wo die Person hinwollte.
    ziel.searchParams.set("weiter", pfad + request.nextUrl.search);
    return NextResponse.redirect(ziel);
  }

  // Angemeldet und trotzdem auf der Anmeldeseite: weiterleiten.
  if (data.user && pfad === "/anmelden") {
    const ziel = request.nextUrl.clone();
    ziel.pathname = "/";
    ziel.search = "";
    return NextResponse.redirect(ziel);
  }

  return response;
}

export const config = {
  matcher: [
    // Alles ausser Next-Interna, Dateien mit Endung - und /api.
    //
    // /api bleibt bewusst aussen vor: die Routen pruefen selbst, und zwar
    // strenger, als es hier moeglich waere (x-api-secret, CRON_SECRET oder
    // eine Adminsitzung). Wuerde die Middleware sie mitfangen, bekaeme der
    // Zeitplan von Vercel eine Weiterleitung auf /anmelden statt der Route,
    // und kein Lauf wuerde je stattfinden.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
