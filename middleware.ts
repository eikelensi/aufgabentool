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
import { mitKeksOptionen } from "@/lib/supabase/keks";

/** Seiten, die ohne Anmeldung erreichbar sein muessen. */
const OFFEN = ["/anmelden", "/passwort-setzen", "/auth"];

/**
 * Kommt dieser Aufruf von unserer eigenen Seite?
 *
 * Das ist die Gegenleistung dafuer, dass der Sitzungs-Keks jetzt auch
 * in fremdem Rahmen mitgeht (siehe lib/supabase/keks.ts): mit
 * SameSite=none wuerde ihn sonst auch eine beliebige fremde Seite
 * mitschicken lassen, die ein Formular auf unsere Schnittstelle
 * abfeuert.
 *
 * Der Browser setzt "Origin" bei jedem schreibenden Aufruf - auch im
 * Rahmen, und dort steht dann UNSERE Adresse, nicht die von onOffice.
 * Genau deshalb funktioniert die Pruefung im Rahmen weiter.
 *
 * Ohne Origin ist es kein Browser: der Zeitplan von Vercel, curl, ein
 * Dienst. Die Routen haben dafuer ihr eigenes Geheimnis; hier wird
 * nichts abgewiesen, was nie ein Browser war.
 */
function fremdeHerkunft(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

const SCHREIBT = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function middleware(request: NextRequest) {
  // Die Schnittstellen bekommen KEINE Sitzungserneuerung und keine
  // Weiterleitung - sie pruefen selbst, und eine Weiterleitung auf
  // /anmelden wuerde jeden Zeitplan stillschweigend leerlaufen lassen.
  // Nur die Herkunft wird angesehen.
  if (request.nextUrl.pathname.startsWith("/api")) {
    if (SCHREIBT.has(request.method) && fremdeHerkunft(request)) {
      return NextResponse.json({ fehler: "Fremde Herkunft." }, { status: 403 });
    }
    return NextResponse.next({ request });
  }

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
        for (const { name, value, options } of liste)
          response.cookies.set(name, value, mitKeksOptionen(options));
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
    // Alles ausser Next-Interna und Dateien mit Endung.
    //
    // /api ist seit der Herkunftspruefung dabei, wird aber ganz oben in
    // der Funktion wieder herausgenommen: dort passiert nur die
    // Herkunftspruefung, keine Sitzungserneuerung und vor allem keine
    // Weiterleitung. Frueher war /api hier ausgeschlossen, weil eine
    // Weiterleitung auf /anmelden jeden Zeitplan von Vercel
    // stillschweigend leerlaufen liesse - das gilt unveraendert, es
    // steht jetzt nur an einer anderen Stelle.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
