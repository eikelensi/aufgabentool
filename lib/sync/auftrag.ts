/**
 * "Auftrag von" - und sein Gegenstueck in onOffice, das Feld "tags".
 *
 * An diesem Feld haengt mehr, als es aussieht: wer dort steht, bekommt
 * die Mail, wenn die Aufgabe erledigt wird oder auf Rueckfragen offen
 * geht. Deshalb steht der Weg dorthin an EINER Stelle und nicht an
 * dreien - die Route, der Pool-Uebergang aus Asana und das Anlegen
 * neuer Aufgaben brauchen ihn alle.
 */
import { modifyTask } from "@/lib/onoffice/tasks";
import { pruefeSchreibsperre } from "@/lib/onoffice/schreibsperre";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Welches Tag meint diesen Kollegen in onOffice?
 *
 * Erst das gepflegte Tag, dann der Nachname aus dem Anzeigenamen,
 * zuletzt das Kuerzel. Dieselbe Rangfolge wie beim Lesen - sonst
 * schriebe das Tool ein Tag hin, das es selbst nicht wiedererkennt.
 */
export async function tagFuerKollegen(brokerId: string | null): Promise<string> {
  if (!brokerId) return "";

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("broker_contacts")
    .select("onoffice_tag, short_code, display_name")
    .eq("id", brokerId)
    .maybeSingle();

  return (
    data?.onoffice_tag?.trim() ||
    String(data?.display_name ?? "").split(",")[0].trim() ||
    data?.short_code?.trim() ||
    ""
  );
}

/**
 * Den Auftraggeber einer Aufgabe nach onOffice schreiben.
 *
 * Wirft nicht: ein Tag, das drueben nicht ankommt, darf weder eine
 * Abgabe in den Pool noch einen Klick in der Oberflaeche scheitern
 * lassen. Was schiefging, steht in der Rueckgabe und im Protokoll.
 */
export async function schreibeAuftragNachOnoffice(taskId: string): Promise<{
  uebertragen: boolean;
  meldung: string;
}> {
  const sb = supabaseAdmin();

  const { data: aufgabe } = await sb
    .from("tasks")
    .select("id, title, onoffice_task_id, broker_contact_id")
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe) return { uebertragen: false, meldung: "Aufgabe nicht gefunden." };

  const tag = await tagFuerKollegen(aufgabe.broker_contact_id);

  // Hier merken wir es uns in jedem Fall - auch ohne Gegenstueck in
  // onOffice. Sonst stuende im Aufgabenfenster ein Auftraggeber und
  // daneben der Hinweis, das Tag sei unbekannt.
  await sb.from("tasks").update({ onoffice_tag: tag || null }).eq("id", aufgabe.id);

  if (!aufgabe.onoffice_task_id) {
    return { uebertragen: false, meldung: "Diese Aufgabe hat kein Gegenstück in onOffice." };
  }

  if (aufgabe.broker_contact_id && !tag) {
    return {
      uebertragen: false,
      meldung:
        "Für diesen Kollegen ist kein onOffice-Tag hinterlegt – nachzutragen in der " +
        "Verwaltung unter Kollegen. Bis dahin steht der Auftraggeber nur hier.",
    };
  }

  const sperre = await pruefeSchreibsperre("inhalt");
  if (!sperre.erlaubt) return { uebertragen: false, meldung: sperre.grund ?? "Gesperrt." };

  try {
    // Leer heisst leer: wer den Auftraggeber herausnimmt, soll ihn
    // auch drueben los sein.
    await modifyTask(aufgabe.onoffice_task_id, { tags: tag });

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: aufgabe.onoffice_task_id,
      ok: true,
      message: tag ? `Tag gesetzt: ${tag}` : "Tag geleert",
      payload: { aufgabe: aufgabe.title },
    });

    return {
      uebertragen: true,
      meldung: tag ? `In onOffice als Tag eingetragen: ${tag}.` : "Das Tag in onOffice ist jetzt leer.",
    };
  } catch (err) {
    const meldung = (err as Error).message;

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: aufgabe.onoffice_task_id,
      ok: false,
      message: `Tag konnte nicht gesetzt werden: ${meldung}`,
      payload: { aufgabe: aufgabe.title, tag },
    });

    return {
      uebertragen: false,
      meldung: `Gespeichert, aber onOffice hat das Tag abgelehnt: ${meldung}`,
    };
  }
}
