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
 * Objekt- und Kundenverknuepfungen MEHRERER Aufgaben in zwei Aufrufen.
 *
 * Der Grund, warum es diese Funktion gibt: die Felder
 * relatedEstateId und relatedAddressId stehen in der Doku als
 * EINGABE fuer das Anlegen und als Filter beim Lesen - als Feld einer
 * Aufgabe gibt onOffice sie nicht heraus. Wir haben sie monatelang
 * beim Lesen angefragt und immer leer bekommen; 136 Aufgaben aus dem
 * CRM hatten im Tool kein einziges verknuepftes Objekt, obwohl in
 * onOffice welche dranhaengen.
 *
 * Der Weg, der funktioniert, ist derselbe wie bei den Anhaengen:
 * idsfromrelation mit mehreren parentids. Zwei Aufrufe fuer einen
 * ganzen Lauf, nicht zwei je Aufgabe.
 *
 * Aufgaben ohne Verknuepfung fehlen in der Antwort und stehen dann
 * auch nicht in der Map. Wirft nicht - eine Verknuepfung, die nicht
 * zu holen ist, darf keinen Abgleich abbrechen.
 */
export async function verknuepfungenFuerAufgaben(taskIds: (string | number)[]): Promise<{
  map: Map<string, TaskRelations>;
  fehler: string[];
}> {
  const map = new Map<string, TaskRelations>();
  const fehler: string[] = [];
  const parentids = [...new Set(taskIds.map(String))].filter(Boolean);
  if (parentids.length === 0) return { map, fehler };

  const hole = async (kind: RelationKind) => {
    const res = await call({
      action: "get",
      resourceType: "idsfromrelation",
      parameters: { relationtype: REL[kind], parentids },
    });

    for (const record of res.records as OnOfficeRecord[]) {
      for (const [aufgabenId, wert] of Object.entries(elements(record))) {
        const ids = nurIds(wert, aufgabenId);
        if (ids.length === 0) continue;
        const bisher = map.get(aufgabenId) ?? { estateIds: [], addressIds: [] };
        const feld = kind === "estate" ? "estateIds" : "addressIds";
        bisher[feld] = [...new Set([...bisher[feld], ...ids])];
        map.set(aufgabenId, bisher);
      }
    }
  };

  for (const kind of ["estate", "address"] as const) {
    try {
      await hole(kind);
    } catch (err) {
      fehler.push(`${kind}: ${(err as Error).message}`);
    }
  }

  return { map, fehler };
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
  /** Was beim Rueckwaertslesen schiefging - "nichts gefunden" und
   *  "darf nicht gefragt werden" sehen sonst gleich aus. */
  fehler: string[];
}> {
  const kind = String(fileId);
  const fehler: string[] = [];

  const hole = async (name: string, urn: string): Promise<string[]> => {
    try {
      const res = await call({
        action: "get",
        resourceType: "idsfromrelation",
        parameters: { relationtype: urn, childids: [kind] },
      });
      const ids = extractIds(res.records as OnOfficeRecord[], kind);
      if (!ids.length) fehler.push(`${name}: keine Verknuepfung`);
      return ids;
    } catch (err) {
      fehler.push(`${name}: ${(err as Error).message}`);
      return [];
    }
  };

  const [estateIds, addressIds, taskIds] = await Promise.all([
    hole("estate", DATEI_ELTERN.estate),
    hole("address", DATEI_ELTERN.address),
    hole("task", DATEI_ELTERN.task),
  ]);

  return { estateIds, addressIds, taskIds, fehler };
}

/**
 * Objekt und Kunde an eine Aufgabe haengen - ausdruecklich, nicht nur
 * als Beigabe beim Anlegen.
 *
 * Beim Anlegen nimmt onOffice relatedEstateId und relatedAddressId
 * entgegen. Beim Objekt kam die Verknuepfung auch an; beim Kunden
 * nicht, stillschweigend, ohne Fehler. Das ist der zweite Anlauf und
 * der dokumentierte Weg: die Relation selbst anlegen.
 *
 * Idempotent, soweit onOffice das zulaesst: eine Relation, die schon
 * besteht, wird nicht doppelt.
 */
export async function verknuepfeAufgabe(
  taskId: string | number,
  ziele: { estateId?: string | null; addressId?: string | null },
): Promise<{ estate: boolean; address: boolean; fehler: string[] }> {
  const fehler: string[] = [];
  const ergebnis = { estate: false, address: false, fehler };

  const setze = async (urn: string, kindId: string): Promise<boolean> => {
    try {
      await call({
        action: "create",
        resourceType: "relation",
        parameters: {
          relationtype: urn,
          parentid: [String(taskId)],
          childid: [String(kindId)],
        },
      });
      return true;
    } catch (err) {
      fehler.push(`${urn.split(":").pop()}: ${(err as Error).message}`);
      return false;
    }
  };

  if (ziele.estateId) ergebnis.estate = await setze(REL.estate, ziele.estateId);
  if (ziele.addressId) ergebnis.address = await setze(REL.address, ziele.addressId);

  return ergebnis;
}
