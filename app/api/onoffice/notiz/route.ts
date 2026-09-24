/**
 * Die Notizen einer Aufgabe nach onOffice schreiben.
 */
import { NextResponse } from "next/server";
import { aktuellesProfil } from "@/lib/supabase/profil";
import { schreibeNotizen } from "@/lib/onoffice/notizen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  const { taskId } = (await request.json().catch(() => ({}))) as { taskId?: string };
  if (!taskId) return NextResponse.json({ fehler: "taskId fehlt." }, { status: 400 });

  const ergebnis = await schreibeNotizen(taskId);
  return NextResponse.json(ergebnis, { status: ergebnis.uebertragen ? 200 : 207 });
}
