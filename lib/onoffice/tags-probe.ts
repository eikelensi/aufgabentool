/**
 * Kommt das Feld "tags" aus onOffice heraus - und wenn ja, wie?
 *
 * Der Anlass: in onOffice steht an der Aufgabe ein Tag ("Spiolek"),
 * im Tool bleibt "Auftrag von" leer. Ein Feldtest vom 16.09. sagt,
 * der Lesecall lehnt "tags" ab - es steht in der Feldkonfiguration
 * des Mandanten, aber nicht im data-Block.
 *
 * Statt weiter zu vermuten, fragen wir. Diese Probe geht mehrere Wege
 * durch und schreibt auf, was jeder geantwortet hat. Sie veraendert
 * NICHTS - nur lesen, nur berichten.
 *
 * Bewusst hier und nicht in der Route: so kann die Verwaltungsseite sie
 * direkt aufrufen. Ein Aufruf der API-Route aus der Adresszeile bringt
 * keine brauchbare Sitzung mit (die Middleware laesst /api aus), und
 * genau daran ist der erste Versuch gescheitert.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tryCall, elements, type OnOfficeRecord } from "@/lib/onoffice/client";
import { TAGS_FELD, TASK_FIELDS, taskFelder } from "@/lib/onoffice/mapping";
import { readTaskFields, type TaskFeld } from "@/lib/onoffice/tasks";

export interface Versuch {
  weg: string;
  geklappt: boolean;
  meldung?: string;
  /** Was an Feldern zurueckkam - nur die Namen, nicht die Inhalte. */
  felder?: string[];
  /** Der Wert von tags, wenn einer kam. */
  tags?: unknown;
}

export interface ProbeErgebnis {
  taskId: number;
  fazit: string;
  versuche: Versuch[];
  /**
   * Wie das Feld in der Feldkonfiguration des Mandanten wirklich heisst.
   * Der wichtigste Teil: wenn "Tags" in onOffice anders heisst als "tags",
   * kann der Lesecall es gar nicht finden - und alle vier Wege oben
   * muessten scheitern, ohne dass das etwas ueber das Feld aussagt.
   */
  feldkandidaten: TaskFeld[];
  feldFehler?: string;
}

export async function tagsProbe(nummer: number): Promise<ProbeErgebnis> {
  const versuche: Versuch[] = [];

  const probiere = async (weg: string, parameters: Record<string, unknown>) => {
    const res = await tryCall({ action: "read", resourceType: "task", parameters });

    if (!res.ok) {
      versuche.push({ weg, geklappt: false, meldung: res.error.message });
      return;
    }

    const satz = (res.result.records as OnOfficeRecord[])[0];
    const e = elements(satz ?? {});
    versuche.push({
      weg,
      geklappt: true,
      felder: Object.keys(e),
      tags: e.tags ?? e.Tags ?? null,
    });
  };

  /**
   * Der Lesecall fuer Aufgaben kennt kein "recordids".
   *
   * Das war mein Fehler, und er hat drei der vier Wege wertlos
   * gemacht: onOffice antwortet mit "Invalid field in input data:
   * recordids" (Code 144). Eine einzelne Aufgabe holt man ueber den
   * FILTER auf ihre Nummer - so macht es der Abgleich auch.
   */
  const filter = { Nr: [{ op: "=", val: String(nummer) }] };

  // 1. Nur das eine Feld. Der schmalste Weg - wenn irgendetwas geht,
  //    dann das.
  await probiere("Filter auf Nr, nur tags", { data: [TAGS_FELD], filter, listlimit: 1 });

  // 2. Alle Felder ausser tags - der Gegenbeweis. Klappt das, liegt
  //    es wirklich an diesem einen Feld und nicht am Aufruf.
  await probiere("Filter auf Nr, alle Felder OHNE tags", {
    data: [...TASK_FIELDS],
    filter,
    listlimit: 1,
  });

  // 3. Alle Felder samt tags - so fragt der Abgleich.
  await probiere("Filter auf Nr, alle Felder MIT tags", {
    data: taskFelder(true),
    filter,
    listlimit: 1,
  });

  // 4. Ohne data. Manche Ressourcen geben dann alles heraus, was sie
  //    haben - und vielleicht faellt tags dabei mit ab.
  await probiere("Filter auf Nr, ohne data", { filter, listlimit: 1 });

  // Und zum Schluss: wie heisst das Feld ueberhaupt? Ein Name, der in
  // der Oberflaeche "Tags" heisst, kann in der Schnittstelle anders
  // heissen - danach zu suchen ist billiger als zu raten.
  let feldkandidaten: TaskFeld[] = [];
  let feldFehler: string | undefined;
  try {
    const alle = await readTaskFields();
    feldkandidaten = alle.filter(
      (f) =>
        /tag/i.test(f.name) ||
        /tag/i.test(f.label ?? "") ||
        /auftrag|makler|ersteller/i.test(f.label ?? ""),
    );
  } catch (err) {
    feldFehler = (err as Error).message;
  }

  const geklappt = versuche.filter((v) => v.geklappt && v.tags);
  const fazit = geklappt.length
    ? `Das Feld "tags" ist lesbar über: ${geklappt.map((v) => v.weg).join(", ")}.`
    : versuche.some((v) => v.geklappt)
      ? 'Die Aufgabe ist lesbar, "tags" kommt aber bei keinem Weg mit. ' +
        "Das Feld muss von onOffice für die Schnittstelle freigeschaltet werden."
      : "Kein Weg hat geantwortet – siehe die Meldungen.";

  // Auch ins Protokoll, damit das Ergebnis nachlesbar bleibt.
  try {
    const sb = supabaseAdmin();
    await sb.from("onoffice_sync_log").insert({
      direction: "pull",
      resource: "task",
      reference: String(nummer),
      ok: geklappt.length > 0,
      message: `Tag-Probe an Aufgabe ${nummer}: ${fazit}`,
      payload: { versuche },
    });
  } catch {
    /* Das Protokoll ist Beiwerk - die Antwort zaehlt. */
  }

  return { taskId: nummer, fazit, versuche, feldkandidaten, feldFehler };
}
