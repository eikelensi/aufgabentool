/**
 * Verknüpfungen einer Aufgabe auflösen.
 *
 * Gegen den Mandanten geprüft (16.09.2026): "idsfromrelation" beantwortet
 * die Frage "welche Datensätze hängen an dieser Aufgabe". Die Ressource
 * "relation" existiert dort nicht (Code 25).
 *
 * Nachtrag 22.09.2026: Es gibt auch einen Relationstyp für die Anhänge
 * selbst – task:file:attachment. Damit ist der Rückweg offen, den wir
 * vorher für verschlossen gehalten haben: erst die Datei-IDs über die
 * Relation, dann jede Datei einzeln über "file" mit fileid. Der frühere
 * Fehlschlag (Code 24) lag daran, dass wir "file" nach einer taskid
 * gefragt haben statt nach einer fileid.
 */

import { call, elements, type OnOfficeRecord } from "./client";

const REL = {
  estate: "urn:onoffice-de-ns:smart:2.5:relationTypes:task:estate",
  address: "urn:onoffice-de-ns:smart:2.5:relationTypes:task:address",
  file: "urn:onoffice-de-ns:smart:2.5:relationTypes:task:file:attachment",
} as const;

/** Relationen, die von einer Datei zu ihrem Datensatz zurueckfuehren. */
const DATEI_ELTERN = {
  estate: "urn:onoffice-de-ns:smart:2.5:relationTypes:estate:allFiles",
  address: "urn:onoffice-de-ns:smart:2.5:relationTypes:address:file:attachment",
  task: "urn:onoffice-de-ns:smart:2.5:relationTypes:task:file:attachment",
} as const;

export type RelationKind = keyof typeof REL;

export interface TaskRelations {
  estateIds: string[];
  addressIds: string[];
}

/** Numerische IDs aus einer Liste ziehen, ohne die Eltern-ID selbst. */
function nurIds(wert: unknown, elternId: string): string[] {
  const ids: string[] = [];
  for (const eintrag of ([] as unknown[]).concat(wert ?? [])) {
    const id = String(eintrag).trim();
    if (/^\d+$/.test(id) && id !== elternId) ids.push(id);
  }
  return ids;
}

/**
 * Die Antwort hat die Form [{ elements: { "<aufgabenId>": ["<id>", ...] } }].
 * Wir ziehen alle numerischen Werte heraus und lassen die Eltern-ID weg.
 */
function extractIds(records: OnOfficeRecord[], parentId: string): string[] {
  const ids = new Set<string>();

  for (const record of records) {
    for (const value of Object.values(elements(record))) {
      for (const id of nurIds(value, parentId)) ids.add(id);
    }
  }

  return [...ids];
}

async function idsFor(kind: RelationKind, taskId: string | number): Promise<string[]> {
  const parentId = String(taskId);
  const res = await call({
    action: "get",
    resourceType: "idsfromrelation",
    parameters: { relationtype: REL[kind], parentids: [parentId] },
  });
  return extractIds(res.records as OnOfficeRecord[], parentId);
}

export async function resolveTaskRelations(taskId: string | number): Promise<TaskRelations> {
  const [estateIds, addressIds] = await Promise.all([
    idsFor("estate", taskId).catch(() => []),
    idsFor("address", taskId).catch(() => []),
  ]);

  return { estateIds, addressIds };
}

/**
 * Die Datei-IDs mehrerer Aufgaben in EINEM Aufruf.
 *
 * Das ist der Grund, warum der Abgleich die Anhänge überhaupt mitnehmen
 * kann: 50 Aufgaben kosten eine Anfrage, nicht fünfzig. Der Schlüssel der
 * Antwort ist die Aufgabennummer – so bleibt die Zuordnung erhalten, die
 * resolveTaskRelations wegwirft.
 *
 * Aufgaben ohne Anhang fehlen in der Antwort; sie stehen dann auch nicht
 * in der Map.
 */
export async function taskFileIds(
  taskIds: (string | number)[],
): Promise<Map<string, string[]>> {
  const ergebnis = new Map<string, string[]>();
  const parentids = [...new Set(taskIds.map(String))].filter(Boolean);
  if (parentids.length === 0) return ergebnis;

  const res = await call({
    action: "get",
    resourceType: "idsfromrelation",
    parameters: { relationtype: REL.file, parentids },
  });

  for (const record of res.records as OnOfficeRecord[]) {
    for (const [aufgabenId, wert] of Object.entries(elements(record))) {
      const ids = nurIds(wert, aufgabenId);
      if (ids.length === 0) continue;
      ergebnis.set(aufgabenId, [...new Set([...(ergebnis.get(aufgabenId) ?? []), ...ids])]);
    }
  }

  return ergebnis;
}

/**
 * Zu welchem Datensatz gehoert eine Datei?
 *
 * "file" will beim Lesen nicht nur die Datei-Nummer, sondern auch den
 * Datensatz, an dem sie haengt - daher "Missing address record id".
 * Ueber childids laesst sich die Relation rueckwaerts lesen: von der
 * Datei zum Objekt, zur Adresse oder zur Aufgabe.
 */
export async function elternVonDatei(fileId: string | number): Promise<{
  estateIds: string[];
  addressIds: string[];
  taskIds: string[];
}> {
  const kind = String(fileId);

  const hole = async (urn: string): Promise<string[]> => {
    try {
      const res = await call({
        action: "get",
        resourceType: "idsfromrelation",
        parameters: { relationtype: urn, childids: [kind] },
      });
      return extractIds(res.records as OnOfficeRecord[], kind);
    } catch {
      return [];
    }
  };

  const [estateIds, addressIds, taskIds] = await Promise.all([
    hole(DATEI_ELTERN.estate),
    hole(DATEI_ELTERN.address),
    hole(DATEI_ELTERN.task),
  ]);

  return { estateIds, addressIds, taskIds };
}
