/**
 * Dateien abgleichen - beide Richtungen.
 *
 * Die Arbeit steckt in lib/sync/anhaenge.ts; hier steht nur, wer sie
 * anstossen darf. Das ist jeder angemeldete Nutzer, nicht nur ein Admin:
 * die Route uebertraegt Dateien, die ohnehin gleich vom Zeitplan geholt
 * wuerden, und wird direkt nach einem Hochladen gerufen, damit die Datei
 * nicht Minuten lang wartet. Ohne Anmeldung passiert nichts.
 */
import { NextResponse } from "next/server";
import { syncAnhaenge } from "@/lib/sync/anhaenge";
import { aktuellesProfil } from "@/lib/supabase/profil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function darfLaufen(request: Request): Promise<boolean> {
  const geheim = process.env.INTERNAL_API_SECRET;
  const kopf = request.headers.get("x-api-secret");
  if (geheim && kopf && kopf === geheim) return true;

  const cron = request.headers.get("authorization");
  if (process.env.CRON_SECRET && cron === `Bearer ${process.env.CRON_SECRET}`) return true;

  return Boolean(await aktuellesProfil());
}

export async function POST(request: Request) {
  if (!(await darfLaufen(request))) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  try {
    const ergebnis = await syncAnhaenge();
    return NextResponse.json({
      pushed: ergebnis.hochgeladen,
      geholt: ergebnis.heruntergeladen,
      uebersprungen: ergebnis.uebersprungen,
      fehler: ergebnis.fehler,
      meldung: ergebnis.meldung,
    });
  } catch (err) {
    return NextResponse.json({ fehler: (err as Error).message }, { status: 500 });
  }
}

export const GET = POST;
