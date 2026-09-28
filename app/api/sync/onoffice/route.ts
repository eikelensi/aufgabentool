/**
 * Aufgaben-Sync anstossen.
 *
 * Zwei Wege hierher: ein Admin ueber den Knopf im Adminbereich, oder ein
 * Zeitplan (Vercel Cron) mit dem Kopfzeilen-Geheimnis. Ohne eines von
 * beiden gibt es nichts.
 */
import { NextResponse } from "next/server";
import { synchronisiereAufgaben } from "@/lib/sync/onoffice-aufgaben";
import { ordneAuftragUeberTagFilter } from "@/lib/sync/tag-abgleich";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function darfLaufen(request: Request): Promise<boolean> {
  const geheim = process.env.INTERNAL_API_SECRET;
  const kopf = request.headers.get("x-api-secret");
  if (geheim && kopf && kopf === geheim) return true;

  // Vercel Cron meldet sich mit einem eigenen Kopf.
  const cron = request.headers.get("authorization");
  if (process.env.CRON_SECRET && cron === `Bearer ${process.env.CRON_SECRET}`) return true;

  return istAdmin(await aktuellesProfil());
}

export async function GET(request: Request) {
  if (!(await darfLaufen(request))) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const seit = searchParams.get("seit") ?? undefined;

  try {
    const ergebnis = await synchronisiereAufgaben({ seit });

    // "Auftrag von" ueber den Tag-Filter nachziehen. Drei Aufrufe fuer
    // den ganzen Bestand - unabhaengig davon, wie viele Aufgaben der
    // Lauf angefasst hat. Scheitert es, steht das im Hinweis und der
    // Abgleich selbst bleibt davon unberuehrt.
    try {
      const tagLauf = await ordneAuftragUeberTagFilter();
      if (tagLauf.zugeordnet) {
        ergebnis.hinweise.push(`${tagLauf.zugeordnet}× „Auftrag von“ über den Tag-Filter gesetzt.`);
      }
      for (const h of tagLauf.hinweise) ergebnis.hinweise.push(h);
    } catch (err) {
      ergebnis.hinweise.push(`Tag-Filter: ${(err as Error).message}`);
    }

    return NextResponse.json(ergebnis, { status: ergebnis.fehler.length ? 207 : 200 });
  } catch (err) {
    return NextResponse.json({ fehler: (err as Error).message }, { status: 500 });
  }
}

export const POST = GET;
