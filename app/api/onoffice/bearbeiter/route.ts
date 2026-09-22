/**
 * Den Bearbeiter nach onOffice zurueckschreiben.
 *
 * Ausgeloest bei JEDER Aenderung der Zuweisung: wenn sich jemand eine
 * Aufgabe aus dem Pool zieht, wenn im Aufgabendialog ein anderer
 * Bearbeiter gewaehlt wird, und wenn eine Aufgabe zurueck in den Pool
 * gelegt wird - dann wird das Feld drueben geleert.
 *
 * Geschrieben wird genau EIN Feld: "Bearbeiter", mit dem
 * onOffice-Anzeigenamen der Person. Nichts sonst - kein Status, kein
 * Betreff, kein Datum.
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
    .select(
      "id, onoffice_task_id, assignee_id, creator_id, is_pool, onoffice_bearbeiter_id, onoffice_assignee, title",
    )
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe) return NextResponse.json({ fehler: "Aufgabe nicht gefunden." }, { status: 404 });

  // Wer darf hier ueberhaupt etwas bewegen: die Person, der die Aufgabe
  // jetzt gehoert, die Person, die sie gerade abgegeben hat (dann steht
  // assignee_id schon auf null), der Verantwortliche - oder ein Admin.
  const darf =
    aufgabe.assignee_id === profil.id ||
    aufgabe.creator_id === profil.id ||
    istAdmin(profil);
  if (!darf) {
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

  // Ohne Bearbeiter im Tool wird das Feld in onOffice GELEERT. Sonst
  // laufen die beiden auseinander: im Tool liegt die Aufgabe im Pool,
  // in onOffice steht weiter der alte Bearbeiter - und der naechste
  // Abgleich holt sie prompt wieder aus dem Pool heraus, weil onOffice
  // bei diesem Feld fuehrt. Abgeben muss in beiden Systemen dasselbe
  // heissen.
  // Wer soll drueben stehen? Zwei Faelle, und der zweite ist der, den
  // das Tool lange nicht konnte:
  //
  //  - ein NUTZER des Tools: sein onoffice_display_name,
  //  - ein KOLLEGE ohne Zugang: sein Kuerzel aus der
  //    Mitarbeiterverwaltung.
  //
  // Beides ist derselbe Wert, den die Schnittstelle beim Lesen liefert:
  // das Kuerzel des onOffice-Logins ("BaufiErcan"), nicht der schoene
  // Name, den die Oberflaeche von onOffice anzeigt. Wer sich daran
  // orientiert, schreibt etwas hinein, das dort niemand kennt.
  let name = "";
  if (aufgabe.assignee_id) {
    const { data: wer } = await sb
      .from("profiles")
      .select("onoffice_display_name, full_name")
      .eq("id", aufgabe.assignee_id)
      .maybeSingle();

    name = wer?.onoffice_display_name?.trim() ?? "";
    if (!name) {
      return NextResponse.json({
        uebertragen: false,
        meldung:
          `Für ${wer?.full_name ?? "diese Person"} ist kein onOffice-Name hinterlegt. ` +
          "Ohne den weiß onOffice nicht, wer gemeint ist – nachzutragen in der Nutzerverwaltung.",
      });
    }
  } else if (aufgabe.onoffice_bearbeiter_id && !aufgabe.is_pool) {
    const { data: kollege } = await sb
      .from("broker_contacts")
      .select("short_code, display_name")
      .eq("id", aufgabe.onoffice_bearbeiter_id)
      .maybeSingle();

    name = kollege?.short_code?.trim() ?? "";
    if (!name) {
      return NextResponse.json({
        uebertragen: false,
        meldung:
          `Für ${kollege?.display_name ?? "diesen Kollegen"} ist kein onOffice-Kürzel ` +
          "hinterlegt. Ohne das weiß onOffice nicht, wer gemeint ist.",
      });
    }
  }

  // Steht in onOffice schon genau das, was wir schreiben wollen, ist
  // nichts zu tun. Spart einen Schreibvorgang in fremde Daten und haelt
  // das Protokoll lesbar.
  if ((aufgabe.onoffice_assignee ?? "").trim() === name) {
    return NextResponse.json({
      uebertragen: false,
      meldung: name
        ? `In onOffice steht bereits ${name} als Bearbeiter.`
        : "In onOffice steht bereits kein Bearbeiter.",
    });
  }

  try {
    await modifyTask(aufgabe.onoffice_task_id, { Bearbeiter: name });

    await sb
      .from("tasks")
      .update({
        onoffice_assignee: name || null,
        onoffice_synced_at: new Date().toISOString(),
      })
      .eq("id", aufgabe.id);

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: aufgabe.onoffice_task_id,
      ok: true,
      message: name
        ? `Bearbeiter auf "${name}" gesetzt, vorher "${aufgabe.onoffice_assignee ?? "leer"}"`
        : `Bearbeiter geleert, vorher "${aufgabe.onoffice_assignee ?? "leer"}"`,
      payload: { aufgabe: aufgabe.title, durch: profil.email },
    });

    return NextResponse.json({
      uebertragen: true,
      meldung: name
        ? `In onOffice als Bearbeiter eingetragen: ${name}.`
        : "Der Bearbeiter ist in onOffice jetzt leer – die Aufgabe ist dort wieder frei.",
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
