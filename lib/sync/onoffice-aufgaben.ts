/**
 * Aufgaben aus onOffice holen.
 *
 * Regel, die alles bestimmt: es werden nur Aufgaben uebernommen, bei denen
 * der Bearbeiter ODER die Verantwortung auf einen Nutzer des Tools passt.
 * Alles andere wird gezaehlt und liegen gelassen - das CRM enthaelt tausende
 * Aufgaben, die hier nichts zu suchen haben.
 *
 * Der Abgleich laeuft ueber profiles.onoffice_display_name, also den String,
 * wie er in den onOffice-Feldern steht ("Lensinger, Eike (EL)"). Nicht ueber
 * die Mailadresse: die Benutzerliste der Schnittstelle gibt in diesem
 * Mandanten nur Mailadressen her und keine Namen, und in den Aufgaben steht
 * umgekehrt nur der Name.
 *
 * Richtung: onOffice fuehrt bei Titel, Beschreibung, Status, Prioritaet und
 * Fristen. Rein lokale Felder - Kategorie, Pflichtnotiz, Maklerkollege,
 * Anhaenge - werden nie ueberschrieben.
 */

import { readTasks, type OnofficeTask } from "@/lib/onoffice/tasks";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface SyncErgebnis {
  gelesen: number;
  uebernommen: number;
  neu: number;
  aktualisiert: number;
  uebersprungen: number;
  unbekannteNamen: string[];
  fehler: string[];
  hinweise: string[];
  seit: string;
  bisModified: string | null;
}

/** onOffice lehnt listoffset fuer Aufgaben ab, Blaettern ist also nicht
 *  moeglich. Wird die Grenze erreicht, muss das Fenster kleiner werden. */
const GRENZE = 500;

/** Namen vergleichbar machen: Grossschreibung und Mehrfach-Leerzeichen weg. */
function normalisiere(name: string | null | undefined): string {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

interface NutzerVerzeichnis {
  /** normalisierter onOffice-Anzeigename -> profile.id */
  nachName: Map<string, string>;
  anzahl: number;
}

async function ladeVerzeichnis(): Promise<NutzerVerzeichnis> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("profiles")
    .select("id, onoffice_display_name")
    .not("onoffice_display_name", "is", null);

  if (error) throw new Error(`Nutzerliste nicht lesbar: ${error.message}`);

  const nachName = new Map<string, string>();
  for (const p of data ?? []) {
    const key = normalisiere(p.onoffice_display_name);
    if (key) nachName.set(key, p.id);
  }
  return { nachName, anzahl: nachName.size };
}

/**
 * Seit wann holen? Der Merker in onoffice_sync_cursor, minus einer
 * Ueberlappung, damit nichts durchfaellt, das waehrend des letzten Laufs
 * geaendert wurde.
 */
async function bestimmeStart(ueberlappungMinuten: number): Promise<string> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("onoffice_sync_cursor")
    .select("last_modified_seen, initial_done")
    .eq("resource", "task")
    .maybeSingle();

  if (!data?.initial_done || !data.last_modified_seen) {
    // Erster Lauf: 180 Tage zurueck. Aelteres ist fuer das Tagesgeschaeft
    // ohne Belang und blaeht die Tabelle nur auf.
    return new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
  }

  const seit = new Date(data.last_modified_seen);
  seit.setMinutes(seit.getMinutes() - ueberlappungMinuten);
  return seit.toISOString().slice(0, 10);
}

function zuZeitstempel(datum: string | null): string | null {
  if (!datum) return null;
  const d = new Date(datum);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function synchronisiereAufgaben(
  optionen: { seit?: string; ueberlappungMinuten?: number } = {},
): Promise<SyncErgebnis> {
  const sb = supabaseAdmin();

  const { data: einstellungen } = await sb
    .from("app_settings")
    .select("sync_overlap_minutes")
    .maybeSingle();

  const ueberlappung = optionen.ueberlappungMinuten ?? einstellungen?.sync_overlap_minutes ?? 5;
  const seit = optionen.seit ?? (await bestimmeStart(ueberlappung));

  const verzeichnis = await ladeVerzeichnis();

  const ergebnis: SyncErgebnis = {
    gelesen: 0,
    uebernommen: 0,
    neu: 0,
    aktualisiert: 0,
    uebersprungen: 0,
    unbekannteNamen: [],
    fehler: [],
    hinweise: [],
    seit,
    bisModified: null,
  };

  if (verzeichnis.anzahl === 0) {
    ergebnis.fehler.push(
      "Kein Nutzer hat einen onOffice-Anzeigenamen hinterlegt. Ohne den kann nicht " +
        "entschieden werden, welche Aufgaben hierher gehoeren. Adminbereich, Nutzerverwaltung.",
    );
    return ergebnis;
  }

  let crmAufgaben: OnofficeTask[] = [];
  try {
    const res = await readTasks({ modifiedSince: seit, listLimit: GRENZE });
    crmAufgaben = res.tasks;
  } catch (err) {
    ergebnis.fehler.push(`Abruf aus onOffice fehlgeschlagen: ${(err as Error).message}`);
    return ergebnis;
  }

  ergebnis.gelesen = crmAufgaben.length;

  if (crmAufgaben.length >= GRENZE) {
    ergebnis.hinweise.push(
      `Es kamen ${GRENZE} Aufgaben zurueck - das ist die Obergrenze eines Abrufs. ` +
        "Blaettern laesst diese Schnittstelle nicht zu (listoffset wird abgelehnt), " +
        "es koennen also aeltere Aenderungen fehlen. Bitte den Lauf mit einem " +
        "kuerzeren Zeitraum wiederholen, dann rueckt der Merker schrittweise vor.",
    );
  }

  // Welche onoffice_task_id kennen wir schon? Bestimmt neu vs. aktualisiert
  // und verhindert, dass ein Upsert lokale Felder ueberschreibt.
  const ids = crmAufgaben.map((t) => t.id).filter(Boolean);
  const bekannt = new Map<string, { id: string; in_progress_note: string | null }>();
  if (ids.length) {
    const { data: vorhanden } = await sb
      .from("tasks")
      .select("id, onoffice_task_id, in_progress_note")
      .in("onoffice_task_id", ids);
    for (const t of vorhanden ?? []) {
      if (t.onoffice_task_id) {
        bekannt.set(t.onoffice_task_id, { id: t.id, in_progress_note: t.in_progress_note });
      }
    }
  }

  const unbekannt = new Set<string>();
  let maxModified: string | null = null;

  for (const aufgabe of crmAufgaben) {
    const modified = zuZeitstempel(aufgabe.modifiedAt);
    if (modified && (!maxModified || modified > maxModified)) maxModified = modified;

    const bearbeiterId = verzeichnis.nachName.get(normalisiere(aufgabe.processor));
    const verantwortungId = verzeichnis.nachName.get(normalisiere(aufgabe.responsibility));

    if (!bearbeiterId && !verantwortungId) {
      ergebnis.uebersprungen++;
      if (aufgabe.processor) unbekannt.add(aufgabe.processor);
      if (aufgabe.responsibility) unbekannt.add(aufgabe.responsibility);
      continue;
    }

    // creator_id darf nicht leer sein. Die Verantwortung ist der richtige
    // Ersteller; fehlt sie, tritt der Bearbeiter ein.
    const creatorId = verantwortungId ?? bearbeiterId!;
    const vorhandene = bekannt.get(aufgabe.id);

    // Die Datenbank verlangt bei "In Bearbeitung" eine Notiz. Aus onOffice
    // kommt keine - das Feld Kommentar existiert in diesem Mandanten nicht.
    // Also ein ehrlicher Platzhalter, aber nur wenn noch keine Notiz da ist.
    let notiz = vorhandene?.in_progress_note ?? null;
    if (aufgabe.status === "in_bearbeitung" && !notiz?.trim()) {
      notiz = "Status aus onOffice übernommen – dort ist keine Notiz hinterlegt.";
    }

    const zeile: Record<string, unknown> = {
      title: aufgabe.subject || "(ohne Betreff)",
      description: aufgabe.description || null,
      status: aufgabe.status,
      priority: aufgabe.priority,
      assignee_id: bearbeiterId ?? null,
      creator_id: creatorId,
      // Kein bekannter Bearbeiter, aber bekannte Verantwortung: die Aufgabe
      // gehoert in den Pool, damit sich jemand daraus zieht.
      is_pool: !bearbeiterId,
      is_private: aufgabe.isPrivate,
      visible_from: aufgabe.startDate ?? new Date().toISOString().slice(0, 10),
      due_date: aufgabe.deadline,
      source: "onoffice",
      onoffice_task_id: aufgabe.id,
      onoffice_synced_at: new Date().toISOString(),
      onoffice_modified_at: modified,
      onoffice_status_raw: aufgabe.rawStatus || null,
      onoffice_prio_raw: aufgabe.rawPriority || null,
      onoffice_assignee: aufgabe.processor || null,
      onoffice_responsible: aufgabe.responsibility || null,
      onoffice_estate_id: aufgabe.relatedEstateId ?? null,
      onoffice_address_id: aufgabe.relatedAddressId ?? null,
      in_progress_note: notiz,
      updated_at: new Date().toISOString(),
    };

    if (aufgabe.status === "erledigt") {
      zeile.completed_at = modified ?? new Date().toISOString();
    } else {
      zeile.completed_at = null;
      zeile.completed_by = null;
    }

    try {
      if (vorhandene) {
        const { error } = await sb.from("tasks").update(zeile).eq("id", vorhandene.id);
        if (error) throw new Error(error.message);
        ergebnis.aktualisiert++;
      } else {
        const { error } = await sb.from("tasks").insert(zeile);
        if (error) throw new Error(error.message);
        ergebnis.neu++;
      }
      ergebnis.uebernommen++;
    } catch (err) {
      ergebnis.fehler.push(`Aufgabe ${aufgabe.id}: ${(err as Error).message}`);
    }
  }

  ergebnis.unbekannteNamen = [...unbekannt].sort();
  ergebnis.bisModified = maxModified;

  // Merker nur fortschreiben, wenn nichts schiefging - sonst wuerde ein
  // Fehler dauerhaft Aufgaben verschlucken.
  if (!ergebnis.fehler.length && maxModified) {
    await sb.from("onoffice_sync_cursor").upsert({
      resource: "task",
      last_modified_seen: maxModified,
      last_run_at: new Date().toISOString(),
      initial_done: true,
    });
  }

  await sb.from("onoffice_sync_log").insert({
    direction: "pull",
    resource: "task",
    reference: `seit ${seit}`,
    ok: ergebnis.fehler.length === 0,
    message:
      `${ergebnis.gelesen} gelesen, ${ergebnis.uebernommen} uebernommen ` +
      `(${ergebnis.neu} neu, ${ergebnis.aktualisiert} aktualisiert), ` +
      `${ergebnis.uebersprungen} uebersprungen`,
    payload: {
      unbekannteNamen: ergebnis.unbekannteNamen.slice(0, 50),
      fehler: ergebnis.fehler.slice(0, 20),
    },
  });

  return ergebnis;
}
