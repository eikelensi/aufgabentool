/**
 * Den Asana-Bereich abgleichen. Zeitplan oder Admin-Knopf.
 */
import { NextResponse } from "next/server";
import { synchronisiereAsana } from "@/lib/sync/asana";
import { synchronisiereEigene } from "@/lib/sync/asana-eigene";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function darfLaufen(request: Request): Promise<boolean> {
  const geheim = process.env.INTERNAL_API_SECRET;
  const kopf = request.headers.get("x-api-secret");
  if (geheim && kopf && kopf === geheim) return true;

  const cron = request.headers.get("authorization");
  if (process.env.CRON_SECRET && cron === `Bearer ${process.env.CRON_SECRET}`) return true;

  return istAdmin(await aktuellesProfil());
}

export async function GET(request: Request) {
  if (!(await darfLaufen(request))) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  try {
    // Zwei Bereiche, ein Abgleich: das Projekt der Geschaeftsfuehrung
    // und die persoenlichen Aufgaben. Nacheinander und nicht parallel,
    // denn eine Aufgabe kann in beidem vorkommen - und dann soll der
    // zweite Lauf sehen, was der erste angelegt hat, statt sie ein
    // zweites Mal anzulegen.
    const ergebnis = await synchronisiereAsana();

    let eigene = null;
    try {
      eigene = await synchronisiereEigene();
    } catch (err) {
      ergebnis.fehler.push(`Eigene Aufgaben: ${(err as Error).message}`);
    }

    const zusammen = {
      ...ergebnis,
      eigene,
      meldung: eigene
        ? `${ergebnis.meldung} · Eigene: ${eigene.meldung}`
        : ergebnis.meldung,
      fehler: [...ergebnis.fehler, ...(eigene?.fehler ?? [])],
    };

    return NextResponse.json(zusammen, { status: zusammen.fehler.length ? 207 : 200 });
  } catch (err) {
    return NextResponse.json({ fehler: (err as Error).message }, { status: 500 });
  }
}

export const POST = GET;
