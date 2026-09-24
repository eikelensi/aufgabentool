/**
 * Eine im Tool angelegte Aufgabe auch in onOffice anlegen.
 *
 * Bis hierher war der Abgleich einseitig: was aus onOffice kam, wurde
 * hier gefuehrt, was hier entstand, blieb hier. Das faellt spaetestens
 * auf, wenn jemand in onOffice nach einer Aufgabe sucht, die es dort nie
 * gab - oder wenn der Bearbeiter drueben arbeitet und den Auftrag nicht
 * findet.
 *
 * Wer drueben eingetragen wird:
 *  - Bearbeiter    = der Bearbeiter im Tool (sein onOffice-Kuerzel),
 *  - Verantwortung = wer die Aufgabe angelegt hat.
 * Fehlt zu einer Person das Kuerzel, bleibt das Feld leer statt falsch:
 * ein Name, den onOffice nicht kennt, ist schlimmer als keiner.
 *
 * Private Aufgaben gehen NICHT hinueber. Sie sind im Tool nur fuer ihren
 * Urheber sichtbar; sie ins CRM zu stellen, wo das halbe Haus mitliest,
 * waere ein Wortbruch.
 */
import { NextResponse } from "next/server";
import { aktuellesProfil } from "@/lib/supabase/profil";
import { legeInOnofficeAn } from "@/lib/sync/onoffice-neu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  const { taskId } = (await request.json().catch(() => ({}))) as { taskId?: string };
  if (!taskId) return NextResponse.json({ fehler: "taskId fehlt." }, { status: 400 });

  const ergebnis = await legeInOnofficeAn(taskId, profil.email);

  // 207: im Tool steht sie, drueben nicht - der Unterschied gehoert in
  // die Antwort, damit die Oberflaeche es sagen kann.
  return NextResponse.json(ergebnis, { status: ergebnis.angelegt ? 200 : 207 });
}
