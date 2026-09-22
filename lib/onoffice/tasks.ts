/**
 * Aufgaben lesen und schreiben (resourcetype "task").
 */

import { call, elements, type OnOfficeRecord } from "./client";
import {
  TASK_FIELDS,
  toIsoDate,
  toOnofficePriority,
  toOnofficeStatus,
  toOurPriority,
  toOurStatus,
} from "./mapping";
import type { TaskPriority, TaskStatus } from "@/lib/types";

export interface OnofficeTask {
  id: string;
  subject: string;
  description: string;
  status: TaskStatus;
  rawStatus: string;
  priority: TaskPriority;
  rawPriority: string;
  /** onOffice-Benutzername, z.B. "Bauer, Sarah (sb)". */
  responsibility: string;
  processor: string;
  startDate: string | null;
  deadline: string | null;
  isPrivate: boolean;
  createdAt: string | null;
  modifiedAt: string | null;
  /** Message-ID der Ursprungsmail, wenn die Aufgabe aus einer Mail entstand. */
  mailMessageId?: string;
  relatedEstateId?: string;
  relatedAddressId?: string;
}

function toTask(record: OnOfficeRecord): OnofficeTask {
  const e = elements(record);
  const str = (key: string) => String(e[key] ?? "").trim();

  return {
    id: String(record.id ?? e.Nr ?? e.id ?? ""),
    subject: str("Betreff") || str("Aufgabe") || "(ohne Betreff)",
    description: str("Aufgabe"),
    status: toOurStatus(e.Status),
    rawStatus: str("Status"),
    priority: toOurPriority(e.Prio),
    rawPriority: str("Prio"),
    responsibility: str("Verantwortung"),
    processor: str("Bearbeiter"),
    startDate: toIsoDate(e.Beginnt_am),
    deadline: toIsoDate(e.Deadline),
    isPrivate: str("Privat") === "1" || str("Privat").toLowerCase() === "true",
    createdAt: toIsoDate(e.Eintragsdatum),
    modifiedAt: toIsoDate(e.modified),
    mailMessageId: str("mailMessageId") || undefined,
    relatedEstateId: str("relatedEstateId") || undefined,
    relatedAddressId: str("relatedAddressId") || undefined,
  };
}

export interface ReadTasksOptions {
  /** Nur Aufgaben eines Bearbeiters (onOffice-Benutzername). */
  processor?: string;
  /** Nur Aufgaben zu einem Objekt bzw. einer Adresse. */
  relatedEstateId?: string | number;
  relatedAddressId?: string | number;
  /** Seit wann geändert – für inkrementelle Läufe (YYYY-MM-DD). */
  modifiedSince?: string;
  listLimit?: number;
  listOffset?: number;
}

export async function readTasks(options: ReadTasksOptions = {}): Promise<{
  tasks: OnofficeTask[];
  total?: number;
}> {
  const filter: Record<string, unknown> = {};
  if (options.processor) filter.Bearbeiter = [{ op: "=", val: options.processor }];
  if (options.modifiedSince) filter.modified = [{ op: ">=", val: options.modifiedSince }];

  const parameters: Record<string, unknown> = {
    data: [...TASK_FIELDS],
    listlimit: options.listLimit ?? 100,
  };
  // listoffset lehnt die task-Ressource in diesem Mandanten ab (Code 144),
  // genau wie sortby. Deshalb nur mitsenden, wenn wirklich geblättert wird –
  // und wenn es auch dann abgelehnt wird, greift readWithoutRejectedFields.
  if (options.listOffset) parameters.listoffset = options.listOffset;
  if (Object.keys(filter).length) parameters.filter = filter;
  if (options.relatedEstateId) parameters.relatedEstateId = String(options.relatedEstateId);
  if (options.relatedAddressId) parameters.relatedAddressId = String(options.relatedAddressId);

  const res = await readWithoutRejectedFields(parameters);
  return { tasks: (res.records as OnOfficeRecord[]).map(toTask), total: res.total };
}

/**
 * Die Feldkonfiguration des Mandanten nennt mehr Felder, als der Lesecall
 * annimmt. Statt jede Ablehnung einzeln zu pflegen, lesen wir den Namen aus
 * der Fehlermeldung, lassen das Feld weg und versuchen es erneut.
 *
 * Bekannt abgelehnt: Nr, newValue, hochgeladenAm, tags, sortby, listoffset.
 */
async function readWithoutRejectedFields(
  parameters: Record<string, unknown>,
  maxVersuche = 4,
): Promise<{ records: unknown[]; total?: number }> {
  const entfernt: string[] = [];
  let aktuell = { ...parameters };

  for (let versuch = 0; versuch < maxVersuche; versuch++) {
    try {
      return await call({ action: "read", resourceType: "task", parameters: aktuell });
    } catch (err) {
      const meldung = (err as Error).message;
      // Form der Meldung: Invalid field in input data: "(0, Nr)" oder "listoffset"
      const treffer = /Invalid field in input data: "(?:\(\d+,\s*)?([^")]+)\)?"/.exec(meldung);
      const feld = treffer?.[1]?.trim();
      if (!feld) throw err;

      const vorher = JSON.stringify(aktuell);
      aktuell = ohneFeld(aktuell, feld);
      if (JSON.stringify(aktuell) === vorher) throw err; // nichts entfernt, sonst Endlosschleife

      entfernt.push(feld);
      console.warn(
        `[onOffice] Feld "${feld}" wurde abgelehnt und weggelassen.` +
          ` Bisher weggelassen: ${entfernt.join(", ")}`,
      );
    }
  }

  throw new Error(
    `onOffice hat den Lesecall nach ${maxVersuche} Versuchen abgelehnt.` +
      ` Weggelassene Felder: ${entfernt.join(", ") || "keine"}`,
  );
}

/** Entfernt ein Feld – als Parameter, aus data und aus filter. */
function ohneFeld(
  parameters: Record<string, unknown>,
  feld: string,
): Record<string, unknown> {
  const kopie: Record<string, unknown> = { ...parameters };
  delete kopie[feld];

  if (Array.isArray(kopie.data)) {
    kopie.data = (kopie.data as string[]).filter((f) => f !== feld);
  }
  if (kopie.filter && typeof kopie.filter === "object") {
    const filter = { ...(kopie.filter as Record<string, unknown>) };
    delete filter[feld];
    if (Object.keys(filter).length) kopie.filter = filter;
    else delete kopie.filter;
  }
  return kopie;
}

export async function readTask(taskId: string | number): Promise<OnofficeTask | null> {
  const res = await call({
    action: "read",
    resourceType: "task",
    parameters: { data: [...TASK_FIELDS], filter: { Nr: [{ op: "=", val: String(taskId) }] } },
  });
  const records = res.records as OnOfficeRecord[];
  return records.length ? toTask(records[0]) : null;
}

export interface CreateTaskInput {
  subject: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  /** onOffice-Benutzername des Bearbeiters. */
  processor?: string;
  responsibility?: string;
  startDate?: string | null;
  deadline?: string | null;
  isPrivate?: boolean;
  comment?: string;
  relatedEstateId?: string | number;
  relatedAddressId?: string | number;
}

export async function createTask(input: CreateTaskInput): Promise<string> {
  // Die Felder der Aufgabe gehoeren in parameters.data. Daneben, auf
  // gleicher Ebene wie data, stehen nur die Verknuepfungen zu Objekt
  // und Kunde - so zeigt es die Doku, und so nimmt es die Schnittstelle
  // an. Siehe den Kommentar bei modifyTask().
  const data: Record<string, unknown> = {
    Betreff: input.subject,
    Aufgabe: input.description ?? input.subject,
    Status: toOnofficeStatus(input.status ?? "offen"),
    Prio: toOnofficePriority(input.priority ?? "normal"),
  };
  if (input.processor) data.Bearbeiter = input.processor;
  if (input.responsibility) data.Verantwortung = input.responsibility;
  if (input.startDate) data.Beginnt_am = input.startDate;
  if (input.deadline) data.Deadline = input.deadline;
  if (input.isPrivate) data.Privat = 1;

  const parameters: Record<string, unknown> = { data };
  if (input.relatedEstateId) parameters.relatedEstateId = String(input.relatedEstateId);
  if (input.relatedAddressId) parameters.relatedAddressId = String(input.relatedAddressId);

  const res = await call({ action: "create", resourceType: "task", parameters });
  const record = (res.records as OnOfficeRecord[])[0];
  const id = String(record?.id ?? elements(record ?? {}).Nr ?? "");
  if (!id) throw new Error("onOffice hat keine Aufgaben-ID zurückgegeben.");
  return id;
}

/**
 * Nur den Status zurückschreiben – das ist alles, was wir nach onOffice
 * spiegeln. Kategorien und interne Felder bleiben bei uns.
 */
export async function pushStatus(
  taskId: string | number,
  status: TaskStatus,
  comment?: string,
): Promise<void> {
  // Das Feld "Kommentar" existiert im Mandanten nicht - nur der Status geht zurueck.
  await modifyTask(taskId, { Status: toOnofficeStatus(status) });
}

/**
 * Felder einer Aufgabe in onOffice aendern.
 *
 * Zwei Dinge, die beide nicht nach ihrem Namen aussehen:
 *
 * 1. Die Aufgabennummer geht als resourceid mit, nicht als identifier.
 *    Die Doku zu "Modify Tasks" sagt "The task ID has to be specified
 *    as resource ID"; mit identifier antwortet die Schnittstelle
 *    "Missing or invalid attribute: resourceid (Code 18)".
 *
 * 2. Die Felder liegen in parameters.DATA, nicht direkt in parameters.
 *    Direkt darunter heisst es "Invalid field in input data: Status
 *    (Code 144)" - die Meldung klingt, als sei das Feld unbekannt,
 *    dabei steht es nur an der falschen Stelle.
 *
 * Beim LESEN faellt beides nicht auf: dort traegt parameters.recordids
 * die Kennung und parameters.data ist eine blosse Feldliste. Deshalb
 * lief die Leserichtung vom ersten Tag an und der erste Schreibversuch
 * scheiterte zweimal hintereinander.
 */
export async function modifyTask(
  taskId: string | number,
  fields: Record<string, unknown>,
): Promise<void> {
  await call({
    action: "modify",
    resourceType: "task",
    resourceId: String(taskId),
    parameters: { data: fields },
  });
}
