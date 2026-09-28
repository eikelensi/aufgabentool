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
import { taskFileIds } from "./relations";

export interface DateiVersuch {
  weg: string;
  geklappt: boolean;
  meldung?: string;
  /** Kam der Inhalt mit - und wie gross ist er? */
  inhaltBytes?: number;
  dateiname?: string;
  felder?: string[];
}

export interface DateiProbeErgebnis {
  aufgabe: string;
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

  // Was haengt laut onOffice an dieser Aufgabe?
  let dateiIds: string[] = [];
  try {
    const map = await taskFileIds([onofficeTaskId]);
    dateiIds = map.get(String(onofficeTaskId)) ?? [];
  } catch (err) {
    return {
      aufgabe: onofficeTaskId,
      dateiIds: [],
      fazit: `Die Anhangsliste war nicht lesbar: ${(err as Error).message}`,
      versuche,
    };
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
      dateiIds,
      objektId,
      kundeId,
      fazit: "An dieser Aufgabe hängt in onOffice keine Datei.",
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
      payload: { dateiIds, objektId, kundeId, versuche },
    });
  } catch {
    /* Das Protokoll ist Beiwerk - die Antwort zaehlt. */
  }

  return {
    aufgabe: onofficeTaskId,
    dateiIds,
    geprueft: String(fileid),
    objektId,
    kundeId,
    fazit,
    versuche,
  };
}
