/**
 * Verknüpfungen einer Aufgabe auflösen.
 *
 * Gegen den Mandanten geprüft (16.09.2026): "idsfromrelation" beantwortet
 * die Frage "welche Objekte/Adressen hängen an dieser Aufgabe". Die
 * Ressource "relation" existiert dort nicht (Code 25).
 *
 * Das ist der einzige Weg, über den wir an Dateien im Umfeld einer Aufgabe
 * kommen: die Aufgaben-Dateien selbst sind über die API nicht lesbar
 * (file + task -> "missing configuration", Code 24), die Dateien eines
 * Objekts oder einer Adresse dagegen schon.
 */

import { call, elements, type OnOfficeRecord } from "./client";

const REL = {
  estate: "urn:onoffice-de-ns:smart:2.5:relationTypes:task:estate",
  address: "urn:onoffice-de-ns:smart:2.5:relationTypes:task:address",
} as const;

export type RelationKind = keyof typeof REL;

export interface TaskRelations {
  estateIds: string[];
  addressIds: string[];
}

/**
 * Die Antwort hat die Form [{ elements: { "<aufgabenId>": ["<id>", ...] } }].
 * Wir ziehen alle numerischen Werte heraus und lassen die Eltern-ID weg.
 */
function extractIds(records: OnOfficeRecord[], parentId: string): string[] {
  const ids = new Set<string>();

  for (const record of records) {
    for (const value of Object.values(elements(record))) {
      for (const entry of ([] as unknown[]).concat(value ?? [])) {
        const id = String(entry).trim();
        if (/^\d+$/.test(id) && id !== parentId) ids.add(id);
      }
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
