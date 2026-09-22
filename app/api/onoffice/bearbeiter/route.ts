/**
 * Den Bearbeiter nach onOffice zurueckschreiben.
 *
 * Ausgeloest, wenn sich jemand eine Aufgabe aus dem Pool zieht. Geschrieben
 * wird genau EIN Feld: "Bearbeiter", mit dem onOffice-Anzeigenamen der
 * Person. Nichts sonst - kein Status, kein Betreff, kein Datum.
 *
 * Das ist der erste Schreibvorgang des Tools in echte CRM-Daten. Deshalb:
 *  - er laeuft nur fuer die eigene Aufgabe (oder als Admin),
 *  - er laesst sich abschalten - mit sync_push_assignee einzeln, mit
 *    sync_read_only zusammen mit allem anderen (lib/onoffice/schreibsperre),
 *  - er wird in onoffice_sync_log festgehalten, gelungen wie gescheitert,
 *  - und wenn er scheitert, bleibt die Uebernahme im Tool trotzdem
 *    bestehen. Ein Ausfall der Schnittstelle darf niemanden daran
 *    hindern, seine Arbeit zu uebernehmen.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import { modifyTask } from "@/lib/onoffice/tasks";
import { pruefeSchreibsperre } from "@/lib/onoffice/schreibsperre";

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
    .select("id, onoffice_task_id, assignee_id, onoffice_assignee, title")
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe) return NextResponse.json({ fehler: "Aufgabe nicht gefunden." }, { status: 404 });

  // Nur fuer die eigene Aufgabe - sonst koennte jeder jeden eintragen.
  if (aufgabe.assignee_id !== profil.id && !istAdmin(profil)) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  if (!aufgabe.onoffice_task_id) {
    return NextResponse.json({
      uebertragen: false,
      meldung: "Diese Aufgabe hat kein Gegenstück in onOffice.",
    });
  }

  // Hauptschalter und Einzelschalter, an einer Stelle geprueft.
  const sperre = await pruefeSchreibsperre("bearbeiter");
  if (!sperre.erlaubt) {
    return NextResponse.json({ uebertragen: false, meldung: sperre.grund });
  }

  // Der Bearbeiter, den das Tool eintraegt, ist der Name, unter dem die
  // Person in onOffice gefuehrt wird - nicht ihr Name bei uns.
  const { data: wer } = await sb
    .from("profiles")
    .select("onoffice_display_name, full_name")
    .eq("id", aufgabe.assignee_id ?? profil.id)
    .maybeSingle();

  const name = wer?.onoffice_display_name?.trim();
  if (!name) {
    return NextResponse.json({
      uebertragen: false,
      meldung:
        `Für ${wer?.full_name ?? "diese Person"} ist kein onOffice-Name hinterlegt. ` +
        "Ohne den weiß onOffice nicht, wer gemeint ist – nachzutragen in der Nutzerverwaltung.",
    });
  }

  try {
    await modifyTask(aufgabe.onoffice_task_id, { Bearbeiter: name });

    await sb
      .from("tasks")
      .update({ onoffice_assignee: name, onoffice_synced_at: new Date().toISOString() })
      .eq("id", aufgabe.id);

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: aufgabe.onoffice_task_id,
      ok: true,
      message: `Bearbeiter auf "${name}" gesetzt`,
      payload: { aufgabe: aufgabe.title, durch: profil.email },
    });

    return NextResponse.json({
      uebertragen: true,
      meldung: `In onOffice als Bearbeiter eingetragen: ${name}.`,
    });
  } catch (err) {
    const meldung = (err as Error).message;

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: aufgabe.onoffice_task_id,
      ok: false,
      message: `Bearbeiter konnte nicht gesetzt werden: ${meldung}`,
      payload: { aufgabe: aufgabe.title, durch: profil.email, name },
    });

    return NextResponse.json(
      {
        uebertragen: false,
        meldung:
          `Die Aufgabe gehört jetzt dir, aber onOffice hat das Eintragen abgelehnt: ${meldung}`,
      },
      { status: 207 },
    );
  }
}
