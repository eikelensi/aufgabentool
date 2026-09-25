/**
 * Eine Aufgabe des Tools nach Asana geben - der Gegenweg zum Pool.
 *
 * Die Arbeit steht in lib/sync/asana-uebergabe.ts; hier ist nur die
 * Tuer und die Frage, wer hindurch darf.
 */
import { NextResponse } from "next/server";
import { aktuellesProfil, darfAlles } from "@/lib/supabase/profil";
import { asanaKonfiguriert } from "@/lib/asana/client";
import { gibNachAsana, ZIELE, type Uebergabeziel } from "@/lib/sync/asana-uebergabe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  // Verteilen darf, wer auch sonst verteilt: Geschaeftsfuehrung,
  // Superadmin, Qualitaetsmanagement.
  if (!darfAlles(profil)) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  if (!asanaKonfiguriert()) {
    return NextResponse.json(
      { fehler: "Asana ist in dieser Umgebung nicht eingerichtet." },
      { status: 503 },
    );
  }

  const { taskId, ziel } = (await request.json().catch(() => ({}))) as {
    taskId?: string;
    ziel?: Uebergabeziel;
  };

  if (!taskId || !ziel || !(ziel in ZIELE)) {
    return NextResponse.json(
      { fehler: "taskId und ein gültiges Ziel sind erforderlich." },
      { status: 400 },
    );
  }

  const res = await gibNachAsana(taskId, ziel, profil.id);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
