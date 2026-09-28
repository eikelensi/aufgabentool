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
  /**
   * Eine Aufgabe, an der nachweislich Dateien haengen - zum
   * Gegenpruefen. Ohne die sagt ein leeres Ergebnis nichts: es kann
   * heissen "hier haengt nichts" oder "die Schnittstelle gibt nichts
   * heraus", und das ist ein Unterschied.
   */
  vergleich?: { aufgabe: string; titel: string; dateien: number } | null;
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

export async function dateiProbe(eingabe: string): Promise<DateiProbeErgebnis> {
  /**
   * Fuehrende Nullen weg.
   *
   * In der onOffice-Oberflaeche steht die Nummer als "032071"; wer
   * sie von dort abschreibt, gibt sie auch so ein. onOffice selbst
   * kennt aber nur "32071" - und antwortet auf "032071" mit einer
   * leeren Liste statt mit einem Fehler. Das sah dann aus, als haenge
   * an der Aufgabe keine Datei, obwohl eine dranhing.
   */
  const onofficeTaskId = String(Number(String(eingabe).replace(/\D/g, "")));

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
    /**
     * Ein leeres Ergebnis allein sagt nichts.
     *
     * Es kann heissen "an dieser Aufgabe haengt nichts" oder "die
     * Schnittstelle gibt nichts heraus". Den Unterschied macht eine
     * zweite Aufgabe, von der wir WISSEN, dass dort Dateien gefunden
     * wurden. Kommt die auch leer zurueck, liegt es an der
     * Schnittstelle; kommt sie voll zurueck, haengt an dieser hier
     * wirklich nichts.
     */
    const { data: andere } = await sb
      .from("task_attachments")
      .select("task_id, tasks!inner ( onoffice_task_id, title )")
      .eq("origin", "onoffice")
      .not("tasks.onoffice_task_id", "is", null)
      .neq("tasks.onoffice_task_id", onofficeTaskId)
      .limit(50);

    const gezaehlt = new Map<string, { titel: string; anzahl: number }>();
    for (const a of andere ?? []) {
      const t = a.tasks as unknown as { onoffice_task_id: string; title: string } | null;
      if (!t?.onoffice_task_id) continue;
      const bisher = gezaehlt.get(t.onoffice_task_id);
      gezaehlt.set(t.onoffice_task_id, {
        titel: t.title,
        anzahl: (bisher?.anzahl ?? 0) + 1,
      });
    }

    const [besteNummer, bestes] = [...gezaehlt.entries()].sort(
      (a, b) => b[1].anzahl - a[1].anzahl,
    )[0] ?? [null, null];

    return {
      aufgabe: onofficeTaskId,
      vergleich: besteNummer
        ? { aufgabe: besteNummer, titel: bestes!.titel, dateien: bestes!.anzahl }
        : null,
      verknuepfungen,
      dateiIds,
      objektId,
      kundeId,
      fazit:
        "Keine der vier Verknüpfungsarten kennt zu dieser Aufgabe eine Datei. " +
        "Alle vier haben geantwortet – abgelehnt hat keine. Ob das heißt " +
        "„hier hängt nichts“ oder „die Schnittstelle gibt nichts heraus“, " +
        "zeigt die Gegenprobe unten.",
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
