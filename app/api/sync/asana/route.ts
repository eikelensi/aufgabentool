/**
 * Den Asana-Bereich abgleichen. Zeitplan oder Admin-Knopf.
 */
import { NextResponse } from "next/server";
import { synchronisiereAsana } from "@/lib/sync/asana";
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
    const ergebnis = await synchronisiereAsana();
    return NextResponse.json(ergebnis, { status: ergebnis.fehler.length ? 207 : 200 });
  } catch (err) {
    return NextResponse.json({ fehler: (err as Error).message }, { status: 500 });
  }
}

export const POST = GET;
