/**
 * Den Bearbeiter nach onOffice zurueckschreiben - die Tuer dazu.
 *
 * Ausgeloest bei JEDER Aenderung der Zuweisung: wenn sich jemand eine
 * Aufgabe aus dem Pool zieht, wenn im Aufgabendialog ein anderer
 * Bearbeiter gewaehlt wird, und wenn eine Aufgabe zurueck in den Pool
 * gelegt wird - dann wird das Feld drueben geleert.
 *
 * Die Arbeit selbst steht in lib/sync/bearbeiter.ts, weil es einen
 * zweiten Weg dorthin gibt, der nicht ueber HTTP laeuft: der Uebergang
 * aus dem Asana-Bereich in den Pool passiert auf dem Server. Hier
 * steht nur noch, WER das anstossen darf.
 *
 * Das ist der erste Schreibvorgang des Tools in echte CRM-Daten. Er
 * laeuft nur fuer die eigene Aufgabe (oder fuer die, die verteilen),
 * er laesst sich abschalten, er wird protokolliert - und wenn er
 * scheitert, bleibt die Uebernahme im Tool trotzdem bestehen. Ein
 * Ausfall der Schnittstelle darf niemanden daran hindern, seine
 * Arbeit zu uebernehmen.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil, darfAlles } from "@/lib/supabase/profil";
import { schreibeBearbeiterNachOnoffice } from "@/lib/sync/bearbeiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  const { taskId } = (await request.json().catch(() => ({}))) as { taskId?: string };
  if (!taskId) return NextResponse.json({ fehler: "taskId fehlt." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: aufgabe } = await sb
    .from("tasks")
    .select("id, assignee_id, creator_id")
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe) return NextResponse.json({ fehler: "Aufgabe nicht gefunden." }, { status: 404 });

  // Wer darf hier etwas bewegen: die Person, der die Aufgabe jetzt
  // gehoert, die Person, die sie gerade abgegeben hat (dann steht
  // assignee_id schon auf null), der Verantwortliche - oder wer
  // verteilt.
  const darf =
    aufgabe.assignee_id === profil.id ||
    aufgabe.creator_id === profil.id ||
    darfAlles(profil);
  if (!darf) return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });

  const ergebnis = await schreibeBearbeiterNachOnoffice(taskId, profil.email);

  return NextResponse.json(
    { uebertragen: ergebnis.uebertragen, meldung: ergebnis.meldung },
    { status: ergebnis.abgelehnt ? 207 : 200 },
  );
}
