/**
 * Kommt das Feld "tags" aus onOffice heraus - und wenn ja, wie?
 *
 * Der Anlass: in onOffice steht an der Aufgabe ein Tag ("Spiolek"),
 * im Tool bleibt "Auftrag von" leer. Ein Feldtest vom 16.09. sagt,
 * der Lesecall lehnt "tags" ab - es steht in der Feldkonfiguration
 * des Mandanten, aber nicht im data-Block. Das war vor einem halben
 * Jahr; seitdem hat sich die Konfiguration geaendert.
 *
 * Statt weiter zu vermuten, fragen wir. Diese Route probiert mehrere
 * Wege durch und schreibt auf, was jeder geantwortet hat. Sie
 * veraendert NICHTS - nur lesen, nur berichten.
 *
 *   GET /api/onoffice/tags-probe?taskId=31987
 *
 * Das Ergebnis steht in der Antwort und im Protokoll, damit es auch
 * nachträglich nachlesbar ist.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import { onofficeConfigured, tryCall, elements, type OnOfficeRecord } from "@/lib/onoffice/client";
import { TASK_FIELDS } from "@/lib/onoffice/mapping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Versuch {
  weg: string;
  geklappt: boolean;
  meldung?: string;
  /** Was an Feldern zurueckkam - nur die Namen, nicht die Inhalte. */
  felder?: string[];
  /** Der Wert von tags, wenn einer kam. */
  tags?: unknown;
}

export async function GET(request: Request) {
  const profil = await aktuellesProfil();
  if (!istAdmin(profil)) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  if (!onofficeConfigured()) {
    return NextResponse.json({ fehler: "onOffice ist nicht eingerichtet." }, { status: 503 });
  }

  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json(
      { fehler: "taskId fehlt. Beispiel: /api/onoffice/tags-probe?taskId=31987" },
      { status: 400 },
    );
  }

  const nummer = Number(taskId);
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

  // 1. Einzelabruf, nur das eine Feld. Der schmalste Weg - wenn
  //    irgendetwas geht, dann das.
  await probiere("recordids + data:[tags]", {
    recordids: [nummer],
    data: ["tags"],
  });

  // 2. Einzelabruf mit allen Feldern. Die Doku zeigt bei
  //    relatedEstateId, dass ein Einzelabruf mehr herausgibt als eine
  //    gefilterte Liste - vielleicht gilt das hier auch.
  await probiere("recordids + alle Felder", {
    recordids: [nummer],
    data: [...TASK_FIELDS],
  });

  // 3. Einzelabruf OHNE data. Manche Ressourcen liefern dann alles,
  //    was sie haben.
  await probiere("recordids ohne data", { recordids: [nummer] });

  // 4. Der Weg, den der Abgleich geht: Filter statt recordids.
  await probiere("filter auf Nr + alle Felder", {
    data: [...TASK_FIELDS],
    filter: { Nr: [{ op: "=", val: String(nummer) }] },
    listlimit: 1,
  });

  const geklappt = versuche.filter((v) => v.geklappt && v.tags);
  const fazit = geklappt.length
    ? `Das Feld "tags" ist lesbar über: ${geklappt.map((v) => v.weg).join(", ")}.`
    : versuche.some((v) => v.geklappt)
      ? 'Die Aufgabe ist lesbar, "tags" kommt aber bei keinem Weg mit. ' +
        "Das Feld muss von onOffice für die Schnittstelle freigeschaltet werden."
      : "Kein Weg hat geantwortet – siehe die Meldungen.";

  const sb = supabaseAdmin();
  await sb.from("onoffice_sync_log").insert({
    direction: "pull",
    resource: "task",
    reference: String(nummer),
    ok: geklappt.length > 0,
    message: `Tag-Probe an Aufgabe ${nummer}: ${fazit}`,
    payload: { versuche },
  });

  return NextResponse.json({ taskId: nummer, fazit, versuche });
}
