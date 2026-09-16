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
    listoffset: options.listOffset ?? 0,
  };
  if (Object.keys(filter).length) parameters.filter = filter;
  if (options.relatedEstateId) parameters.relatedEstateId = String(options.relatedEstateId);
  if (options.relatedAddressId) parameters.relatedAddressId = String(options.relatedAddressId);

  const res = await call({ action: "read", resourceType: "task", parameters });
  return { tasks: (res.records as OnOfficeRecord[]).map(toTask), total: res.total };
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
  const parameters: Record<string, unknown> = {
    Betreff: input.subject,
    Aufgabe: input.description ?? input.subject,
    Status: toOnofficeStatus(input.status ?? "offen"),
    Prio: toOnofficePriority(input.priority ?? "normal"),
  };
  if (input.processor) parameters.Bearbeiter = input.processor;
  if (input.responsibility) parameters.Verantwortung = input.responsibility;
  if (input.startDate) parameters.Beginnt_am = input.startDate;
  if (input.deadline) parameters.Deadline = input.deadline;
  if (input.isPrivate) parameters.Privat = 1;
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
  const parameters: Record<string, unknown> = { Status: toOnofficeStatus(status) };

  await call({
    action: "modify",
    resourceType: "task",
    identifier: taskId,
    parameters,
  });
}

export async function modifyTask(
  taskId: string | number,
  fields: Record<string, unknown>,
): Promise<void> {
  await call({
    action: "modify",
    resourceType: "task",
    identifier: taskId,
    parameters: fields,
  });
}
