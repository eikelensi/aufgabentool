/**
 * Den Bearbeiter nach onOffice zurueckschreiben.
 *
 * Ausgeloest, wenn sich jemand eine Aufgabe aus dem Pool zieht. Geschrieben
 * wird genau EIN Feld: "Bearbeiter", mit dem onOffice-Anzeigenamen der
 * Person. Nichts sonst - kein Status, kein Betreff, kein Datum.
 *
 * Das ist der erste Schreibvorgang des Tools in echte CRM-Daten. Deshalb:
 *  - er laeuft nur fuer die eigene Aufgabe (oder als Admin),
 *  - er laesst sich mit app_settings.sync_push_assignee abschalten,
 *  - er wird in onoffice_sync_log festgehalten, gelungen wie gescheitert,
 *  - und wenn er scheitert, bleibt die Uebernahme im Tool trotzdem
 *    bestehen. Ein Ausfall der Schnittstelle darf niemanden daran
 *    hindern, seine Arbeit zu uebernehmen.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import { modifyTask } from "@/lib/onoffice/tasks";
import { onofficeConfigured } from "@/lib/onoffice/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  const { taskId } = (await request.json().catch(() => ({}))) as { taskId?: string };
  if (!taskId) return NextResponse.json({ fehler: "taskId fehlt." }, { status: 400 });

  const sb = supabaseAdmin();

  const [{ data: einst }, { data: aufgabe }] = await Promise.all([
    sb.from("app_settings").select("sync_push_assignee").maybeSingle(),
    sb
      .from("tasks")
      .select("id, onoffice_task_id, assignee_id, onoffice_assignee, title")
      .eq("id", taskId)
      .maybeSingle(),
  ]);

  if (!aufgabe) return NextResponse.json({ fehler: "Aufgabe nicht gefunden." }, { status: 404 });

  // Nur fuer die eigene Aufgabe - sonst koennte jeder jeden eintragen.
  if (aufgabe.assignee_id !== profil.id && !istAdmin(profil)) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  if (einst?.sync_push_assignee === false) {
    return NextResponse.json({ uebertragen: false, meldung: "Rückschreiben ist abgeschaltet." });
  }
  if (!aufgabe.onoffice_task_id) {
    return NextResponse.json({
      uebertragen: false,
      meldung: "Diese Aufgabe hat kein Gegenstück in onOffice.",
    });
  }
  if (!onofficeConfigured()) {
    return NextResponse.json({
      uebertragen: false,
      meldung: "Die onOffice-Zugangsdaten sind nicht gesetzt.",
    });
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
