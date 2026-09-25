/**
 * Die Tag-Probe als HTTP-Route - fuer Werkzeuge, nicht fuer den Browser.
 *
 * Die eigentliche Arbeit steht in lib/onoffice/tags-probe.ts. Diese Route
 * ist nur die Huelle. Wer im Browser sitzt, nimmt den Knopf unter
 * Verwaltung → onOffice-Eingang: ein Aufruf aus der Adresszeile bringt
 * hierher keine Sitzung mit, weil die Middleware /api bewusst auslaesst.
 *
 *   GET /api/onoffice/tags-probe?taskId=31987
 *
 * Erlaubt ist der Aufruf mit Adminsitzung ODER mit dem Header
 * x-api-secret - so wie bei den anderen Routen unter /api/onoffice.
 */
import { NextResponse } from "next/server";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import { onofficeConfigured } from "@/lib/onoffice/client";
import { tagsProbe } from "@/lib/onoffice/tags-probe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.INTERNAL_API_SECRET;
  const mitGeheimnis = Boolean(secret) && request.headers.get("x-api-secret") === secret;

  if (!mitGeheimnis) {
    const profil = await aktuellesProfil();
    if (!istAdmin(profil)) {
      return NextResponse.json(
        {
          fehler: "Nicht berechtigt.",
          hinweis:
            "Diese Route sieht keine Anmeldung aus der Adresszeile. " +
            "Nimm den Knopf unter Verwaltung → onOffice-Eingang.",
        },
        { status: 403 },
      );
    }
  }

  if (!onofficeConfigured()) {
    return NextResponse.json({ fehler: "onOffice ist nicht eingerichtet." }, { status: 503 });
  }

  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId || !Number.isFinite(Number(taskId))) {
    return NextResponse.json(
      { fehler: "taskId fehlt. Beispiel: /api/onoffice/tags-probe?taskId=31987" },
      { status: 400 },
    );
  }

  return NextResponse.json(await tagsProbe(Number(taskId)));
}
