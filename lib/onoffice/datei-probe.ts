/**
 * Kommen die Anhaenge einer onOffice-Aufgabe hier an - und wenn nicht,
 * woran liegt es?
 *
 * Der Stand, der diese Probe noetig macht: die LISTE der Anhaenge
 * bekommen wir (ueber die Relation task:file:attachment, fuenfzehn
 * Dateien sind erfasst). Der INHALT nicht. Der Lesecall "file" gibt
 * eine Datei nur ueber den Datensatz heraus, an dem sie haengt, und er
 * kennt dafuer laut Doku nur estate und address - "task" beantwortet
 * er mit "missing configuration for resourceId" (Code 24). Der
 * Rueckweg von der Datei zu ihrem Datensatz ist in diesem Mandanten
 * ebenfalls zu ("Not implemented", Code 199).
 *
 * Offen ist damit genau eine Frage, und die beantwortet diese Probe:
 * laesst sich eine Datei, die an einer Aufgabe haengt, ueber das
 * OBJEKT oder den KUNDEN der Aufgabe holen? Die beiden Nummern kennen
 * wir aus unserer eigenen Datenbank - dafuer braucht es keine Relation
 * rueckwaerts.
 *
 * Sie veraendert nichts. Nur lesen, nur berichten.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tryCall, elements, type OnOfficeRecord } from "./client";
import { DATEI_VERKNUEPFUNGEN, dateiIdsUeber, taskFileIds } from "./relations";

export interface DateiVersuch {
  weg: string;
  geklappt: boolean;
  meldung?: string;
  /** Kam der Inhalt mit - und wie gross ist er? */
  inhaltBytes?: number;
  dateiname?: string;
  felder?: string[];
}

export interface Verknuepfungsversuch {
  art: string;
  anzahl: number;
  ids: string[];
  fehler?: string;
}

export interface DateiProbeErgebnis {
  aufgabe: string;
  /** Welche Verknuepfungsart wie viele Dateien kennt. */
  verknuepfungen: Verknuepfungsversuch[];
  /** Die Anhaenge laut Relation. */
  dateiIds: string[];
  /** Die Datei, mit der geprueft wurde. */
  geprueft?: string;
  objektId?: string | null;
  kundeId?: string | null;
  fazit: string;
  versuche: DateiVersuch[];
}

export async function dateiProbe(onofficeTaskId: string): Promise<DateiProbeErgebnis> {
  const versuche: DateiVersuch[] = [];
  const sb = supabaseAdmin();

  /**
   * Erst einmal: HAENGT ueberhaupt etwas dran, und woran?
   *
   * Eine Aufgabe in onOffice ist im Kern ein Kalendereintrag. Wer im
   * CRM eine Datei an eine Aufgabe haengt, legt sie damit nicht
   * zwangslaeufig unter task:file:attachment ab. Also alle vier
   * Tueren anklopfen und aufschreiben, welche aufgeht - das ist
   * billiger als die Annahme, es gaebe nur eine.
   */
  const verknuepfungen: Verknuepfungsversuch[] = [];
  for (const [art, urn] of Object.entries(DATEI_VERKNUEPFUNGEN)) {
    const res = await dateiIdsUeber(urn, onofficeTaskId);
    verknuepfungen.push({ art, anzahl: res.ids.length, ids: res.ids.slice(0, 10), fehler: res.fehler });
  }

  // Die erste Verknuepfungsart, die etwas kennt.
  let dateiIds: string[] = verknuepfungen.find((v) => v.anzahl > 0)?.ids ?? [];

  if (!dateiIds.length) {
    try {
      const map = await taskFileIds([onofficeTaskId]);
      dateiIds = map.get(String(onofficeTaskId)) ?? [];
    } catch {
      /* die Einzelabfragen oben haben es schon versucht */
    }
  }

  // Objekt und Kunde der Aufgabe - aus unserer eigenen Datenbank.
  const { data: aufgabe } = await sb
    .from("tasks")
    .select("onoffice_estate_id, onoffice_address_id")
    .eq("onoffice_task_id", onofficeTaskId)
    .maybeSingle();

  const objektId = aufgabe?.onoffice_estate_id ?? null;
  const kundeId = aufgabe?.onoffice_address_id ?? null;

  if (!dateiIds.length) {
    return {
      aufgabe: onofficeTaskId,
      verknuepfungen,
      dateiIds,
      objektId,
      kundeId,
      fazit:
        "Keine der vier Verknüpfungsarten kennt zu dieser Aufgabe eine Datei. " +
        "Entweder hängt dort wirklich nichts, oder onOffice legt den Anhang " +
        "an einer Stelle ab, die die Schnittstelle nicht herausgibt.",
      versuche,
    };
  }

  const fileid = Number(dateiIds[0]);

  const probiere = async (
    weg: string,
    resourceId: string | undefined,
    parameters: Record<string, unknown>,
  ) => {
    const res = await tryCall({
      action: "get",
      resourceType: "file",
      resourceId,
      parameters: { ...parameters, includeImageUrl: "original" },
    });

    if (!res.ok) {
      versuche.push({ weg, geklappt: false, meldung: res.error.message });
      return;
    }

    const satz = (res.result.records as OnOfficeRecord[])[0];
    if (!satz) {
      versuche.push({ weg, geklappt: false, meldung: "leere Antwort" });
      return;
    }

    const e = elements(satz);
    const inhalt = typeof e.content === "string" ? e.content : "";
    versuche.push({
      weg,
      geklappt: true,
      felder: Object.keys(e),
      dateiname: typeof e.filename === "string" ? e.filename : undefined,
      // Nur die Groesse, nicht der Inhalt - eine Probe soll berichten,
      // nicht die halbe Datei durch das Protokoll schieben.
      inhaltBytes: inhalt ? Math.round((inhalt.length * 3) / 4) : 0,
    });
  };

  if (objektId) {
    await probiere("über das Objekt der Aufgabe", "estate", {
      estateid: Number(objektId),
      fileid,
    });
  }
  if (kundeId) {
    await probiere("über den Kunden der Aufgabe", "address", {
      addressid: Number(kundeId),
      fileid,
    });
  }
  await probiere("resourceId „task“", "task", { fileid, taskid: Number(onofficeTaskId) });
  await probiere("ohne resourceId", undefined, { fileid });
  await probiere("Datei-Nummer als resourceId", String(fileid), {});

  const mitInhalt = versuche.filter((v) => v.geklappt && (v.inhaltBytes ?? 0) > 0);
  const fazit = mitInhalt.length
    ? `Der Inhalt kommt über: ${mitInhalt.map((v) => v.weg).join(", ")}. Damit lässt sich der Rückweg bauen.`
    : versuche.some((v) => v.geklappt)
      ? "Die Datei ist beschreibbar, aber ohne Inhalt. Dann gibt die Schnittstelle sie nicht heraus."
      : "Kein Weg hat die Datei herausgegeben – siehe die Meldungen. Dann muss onOffice das freischalten.";

  try {
    await sb.from("onoffice_sync_log").insert({
      direction: "pull",
      resource: "file",
      reference: String(onofficeTaskId),
      ok: mitInhalt.length > 0,
      message: `Datei-Probe an Aufgabe ${onofficeTaskId}: ${fazit}`,
      payload: { verknuepfungen, dateiIds, objektId, kundeId, versuche },
    });
  } catch {
    /* Das Protokoll ist Beiwerk - die Antwort zaehlt. */
  }

  return {
    aufgabe: onofficeTaskId,
    verknuepfungen,
    dateiIds,
    geprueft: String(fileid),
    objektId,
    kundeId,
    fazit,
    versuche,
  };
}
