/**
 * Den Bearbeiter nach onOffice zurueckschreiben.
 *
 * Herausgeloest aus app/api/onoffice/bearbeiter, weil es zwei Wege
 * hierher gibt und nur einer ueber HTTP laeuft: die Oberflaeche ruft
 * die Route, der Uebergang aus dem Asana-Bereich in den Pool passiert
 * auf dem Server. Der zweite fehlte lange - und das war kein
 * Schoenheitsfehler, siehe unten.
 *
 * Geschrieben wird genau EIN Feld: "Bearbeiter", mit dem
 * onOffice-Anzeigenamen. Nichts sonst.
 *
 * Ohne Bearbeiter im Tool wird das Feld drueben GELEERT. Das muss so:
 * onOffice fuehrt bei diesem Feld. Bliebe dort der alte Name stehen,
 * waehrend die Aufgabe hier im Pool liegt, holte der naechste
 * Abgleich sie prompt wieder heraus und gaebe sie demselben Menschen
 * zurueck, der sie gerade abgegeben hat. Abgeben muss in beiden
 * Systemen dasselbe heissen.
 */
import { modifyTask } from "@/lib/onoffice/tasks";
import { pruefeSchreibsperre } from "@/lib/onoffice/schreibsperre";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface BearbeiterErgebnis {
  uebertragen: boolean;
  meldung: string;
  /** true, wenn onOffice den Schreibvorgang abgelehnt hat. */
  abgelehnt?: boolean;
}

export async function schreibeBearbeiterNachOnoffice(
  taskId: string,
  durch?: string,
): Promise<BearbeiterErgebnis> {
  const sb = supabaseAdmin();

  const { data: aufgabe } = await sb
    .from("tasks")
    .select(
      "id, onoffice_task_id, assignee_id, is_pool, onoffice_bearbeiter_id, onoffice_assignee, title",
    )
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe) return { uebertragen: false, meldung: "Aufgabe nicht gefunden." };

  if (!aufgabe.onoffice_task_id) {
    return { uebertragen: false, meldung: "Diese Aufgabe hat kein Gegenstück in onOffice." };
  }

  const sperre = await pruefeSchreibsperre("bearbeiter");
  if (!sperre.erlaubt) return { uebertragen: false, meldung: sperre.grund ?? "Gesperrt." };

  // Wer soll drueben stehen? Zwei Faelle:
  //
  //  - ein NUTZER des Tools: sein onoffice_display_name,
  //  - ein KOLLEGE ohne Zugang: sein Kuerzel aus der
  //    Mitarbeiterverwaltung.
  //
  // Beides ist derselbe Wert, den die Schnittstelle beim Lesen
  // liefert: das Kuerzel des onOffice-Logins ("BaufiErcan"), nicht der
  // schoene Name, den die Oberflaeche von onOffice anzeigt.
  let name = "";
  if (aufgabe.assignee_id) {
    const { data: wer } = await sb
      .from("profiles")
      .select("onoffice_display_name, full_name")
      .eq("id", aufgabe.assignee_id)
      .maybeSingle();

    name = wer?.onoffice_display_name?.trim() ?? "";
    if (!name) {
      return {
        uebertragen: false,
        meldung:
          `Für ${wer?.full_name ?? "diese Person"} ist kein onOffice-Name hinterlegt. ` +
          "Ohne den weiß onOffice nicht, wer gemeint ist – nachzutragen in der Nutzerverwaltung.",
      };
    }
  } else if (aufgabe.onoffice_bearbeiter_id && !aufgabe.is_pool) {
    const { data: kollege } = await sb
      .from("broker_contacts")
      .select("short_code, display_name")
      .eq("id", aufgabe.onoffice_bearbeiter_id)
      .maybeSingle();

    name = kollege?.short_code?.trim() ?? "";
    if (!name) {
      return {
        uebertragen: false,
        meldung:
          `Für ${kollege?.display_name ?? "diesen Kollegen"} ist kein onOffice-Kürzel ` +
          "hinterlegt. Ohne das weiß onOffice nicht, wer gemeint ist.",
      };
    }
  }

  // Steht drueben schon genau das, was wir schreiben wollen, ist
  // nichts zu tun. Spart einen Schreibvorgang in fremde Daten und
  // haelt das Protokoll lesbar.
  if ((aufgabe.onoffice_assignee ?? "").trim() === name) {
    return {
      uebertragen: false,
      meldung: name
        ? `In onOffice steht bereits ${name} als Bearbeiter.`
        : "In onOffice steht bereits kein Bearbeiter.",
    };
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
      payload: { aufgabe: aufgabe.title, durch: durch ?? "System" },
    });

    return {
      uebertragen: true,
      meldung: name
        ? `In onOffice als Bearbeiter eingetragen: ${name}.`
        : "Der Bearbeiter ist in onOffice jetzt leer – die Aufgabe ist dort wieder frei.",
    };
  } catch (err) {
    const meldung = (err as Error).message;

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: aufgabe.onoffice_task_id,
      ok: false,
      message: `Bearbeiter konnte nicht gesetzt werden: ${meldung}`,
      payload: { aufgabe: aufgabe.title, durch: durch ?? "System", name },
    });

    return {
      uebertragen: false,
      abgelehnt: true,
      meldung: `Die Aufgabe gehört jetzt dir, aber onOffice hat das Eintragen abgelehnt: ${meldung}`,
    };
  }
}
