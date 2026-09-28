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
  /**
   * Der Umweg: laesst sich nach dem Tag FILTERN, auch wenn es sich
   * nicht lesen laesst? Dann braeuchten wir onOffice nicht abzuwarten -
   * wir fragen dann je Tag "welche Aufgaben tragen dich?" statt je
   * Aufgabe "welches Tag traegst du?".
   */
  filterwege: Versuch[];
  filterFazit: string;
}

export async function tagsProbe(eingegeben: number): Promise<ProbeErgebnis> {
  // Fuehrende Nullen weg - siehe datei-probe.ts. onOffice kennt
  // "32071", nicht "032071".
  const nummer = Number(eingegeben);

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

  // Der Umweg, und der eigentliche Grund fuer diese Runde: LESEN ist
  // abgelehnt (Code 144). Filtern ist ein anderer Weg durch dieselbe
  // Schnittstelle - manche Felder sind nur fuer das eine freigegeben.
  // Klappt es, drehen wir die Frage um: nicht "welches Tag hat diese
  // Aufgabe", sondern "welche Aufgaben tragen dieses Tag". Das Ergebnis
  // ist dasselbe, und es braucht keine Freischaltung durch onOffice.
  const filterwege: Versuch[] = [];

  const tagsFeld = feldkandidaten.find((f) => f.name === TAGS_FELD);
  const schluessel = Object.keys(tagsFeld?.wertLabels ?? {});

  const filterProbe = async (weg: string, parameters: Record<string, unknown>) => {
    const res = await tryCall({ action: "read", resourceType: "task", parameters });
    if (!res.ok) {
      filterwege.push({ weg, geklappt: false, meldung: res.error.message });
      return;
    }
    const saetze = res.result.records as OnOfficeRecord[];
    filterwege.push({
      weg,
      geklappt: true,
      meldung: `${saetze.length} Aufgabe(n) getroffen`,
      felder: saetze.slice(0, 5).map((r) => String(elements(r).Nr ?? r.id ?? "?")),
    });
  };

  if (schluessel.length) {
    const ersterSchluessel = schluessel[0];
    const ersteBeschriftung = tagsFeld?.wertLabels?.[ersterSchluessel] ?? ersterSchluessel;

    // a) Der interne Schluessel - so speichert onOffice Mehrfachauswahlen.
    await filterProbe(`Filter auf tags = Schlüssel „${ersterSchluessel}“`, {
      data: ["Nr", "Betreff"],
      filter: { [TAGS_FELD]: [{ op: "=", val: ersterSchluessel }] },
      listlimit: 5,
    });

    // b) Die Beschriftung - falls der Filter uebersetzt.
    await filterProbe(`Filter auf tags = Beschriftung „${ersteBeschriftung}“`, {
      data: ["Nr", "Betreff"],
      filter: { [TAGS_FELD]: [{ op: "=", val: ersteBeschriftung }] },
      listlimit: 5,
    });

    // c) Die scharfe Frage: DIESE Aufgabe UND dieses Tag. Kommt sie
    //    zurueck, traegt sie das Tag - ohne dass wir es je gelesen haetten.
    await filterProbe(`Diese Aufgabe UND tags = „${ersteBeschriftung}“`, {
      data: ["Nr", "Betreff"],
      filter: {
        Nr: [{ op: "=", val: String(nummer) }],
        [TAGS_FELD]: [{ op: "=", val: ersterSchluessel }],
      },
      listlimit: 5,
    });
  }

  const filterGeht = filterwege.some((v) => v.geklappt);
  const filterFazit = !schluessel.length
    ? "Kein Tag-Feld mit erlaubten Werten gefunden – ohne die Schlüssel lässt sich nicht filtern."
    : filterGeht
      ? "Filtern nach dem Tag wird angenommen. Damit kommen wir ohne Freischaltung des Lesefelds aus."
      : "Auch der Filter auf „tags“ wird abgelehnt – das Feld ist für die Schnittstelle vollständig gesperrt.";

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
      payload: { versuche, filterwege, filterFazit },
    });
  } catch {
    /* Das Protokoll ist Beiwerk - die Antwort zaehlt. */
  }

  return { taskId: nummer, fazit, versuche, feldkandidaten, feldFehler, filterwege, filterFazit };
}
