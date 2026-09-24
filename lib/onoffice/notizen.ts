/**
 * Notizen nach onOffice bringen.
 *
 * Der geplante Weg war das Feld "Kommentar" - die Dokumentation kennt
 * es. Die Feldabfrage im Mandanten der 4waendekanzlei kennt es nicht:
 * zweiundzwanzig Felder, kein Kommentar. Bleibt das einzige Textfeld,
 * das eine Aufgabe dort hat: "Aufgabe", also die Beschreibung.
 *
 * Damit sich beides vertraegt, bekommt der Notizteil eine Marke. Was
 * darunter steht, gehoert dem Tool; was darueber steht, ist die
 * Beschreibung und wird beim Abgleich zurueckgelesen. Ohne diese
 * Trennung waeren die Notizen beim naechsten Lauf Teil der
 * Beschreibung - und beim uebernaechsten doppelt.
 */

import { modifyTask } from "./tasks";
import { pruefeSchreibsperre } from "./schreibsperre";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const NOTIZ_MARKE = "----- Notizen aus dem Aufgabentool -----";

/** Den Notizteil abschneiden: liefert die reine Beschreibung. */
export function ohneNotizen(text: string | null | undefined): string {
  const roh = String(text ?? "");
  const i = roh.indexOf(NOTIZ_MARKE);
  return (i < 0 ? roh : roh.slice(0, i)).trimEnd();
}

function datum(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface NotizErgebnis {
  uebertragen: boolean;
  meldung: string;
}

/**
 * Den Notizblock einer Aufgabe drueben neu schreiben.
 *
 * Immer alle Notizen, nicht nur die neue: onOffice kennt kein
 * Anhaengen, wir schreiben das Feld als Ganzes. Das ist auch das
 * Robustere - wer drueben im Text herumeditiert, bekommt beim
 * naechsten Mal wieder den vollstaendigen Stand.
 */
export async function schreibeNotizen(taskId: string): Promise<NotizErgebnis> {
  const sb = supabaseAdmin();

  const { data: aufgabe } = await sb
    .from("tasks")
    .select("id, title, description, onoffice_task_id, is_private")
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe?.onoffice_task_id) {
    return { uebertragen: false, meldung: "Diese Aufgabe hat kein Gegenstück in onOffice." };
  }
  if (aufgabe.is_private) {
    return { uebertragen: false, meldung: "Private Aufgaben bleiben im Tool." };
  }

  const sperre = await pruefeSchreibsperre("inhalt");
  if (!sperre.erlaubt) return { uebertragen: false, meldung: sperre.grund ?? "Gesperrt." };

  const { data: notizen } = await sb
    .from("task_notes")
    .select("body, created_at, author_id, profiles ( full_name )")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (!notizen?.length) {
    return { uebertragen: false, meldung: "Keine Notizen vorhanden." };
  }

  const zeilen = notizen.map((n) => {
    const wer = (n.profiles as unknown as { full_name?: string } | null)?.full_name ?? "Unbekannt";
    return `[${datum(n.created_at)} · ${wer}]\n${String(n.body).trim()}`;
  });

  const text = `${ohneNotizen(aufgabe.description)}\n\n${NOTIZ_MARKE}\n${zeilen.join("\n\n")}`.trim();

  try {
    await modifyTask(aufgabe.onoffice_task_id, { Aufgabe: text });

    await sb
      .from("task_notes")
      .update({ onoffice_pushed_at: new Date().toISOString(), onoffice_error: null })
      .eq("task_id", taskId);

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: aufgabe.onoffice_task_id,
      ok: true,
      message: `Notizen übertragen (${notizen.length}): ${aufgabe.title}`,
    });

    return { uebertragen: true, meldung: `${notizen.length} Notiz(en) in onOffice hinterlegt.` };
  } catch (err) {
    const meldung = (err as Error).message;

    await sb.from("task_notes").update({ onoffice_error: meldung }).eq("task_id", taskId);
    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: aufgabe.onoffice_task_id,
      ok: false,
      message: `Notizen nicht übertragen: ${meldung}`,
    });

    return { uebertragen: false, meldung: `onOffice hat die Notiz abgelehnt: ${meldung}` };
  }
}
