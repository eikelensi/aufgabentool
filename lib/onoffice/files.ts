/**
 * Dateien an onOffice-Aufgaben.
 *
 * Hochladen ist zweistufig dokumentiert:
 *   1. action "do" / resourcetype "uploadfile" mit { data: <base64> }
 *      -> Antwort enthält tmpUploadId
 *   2. derselbe resourcetype mit { tmpUploadId, module: "task",
 *      relatedRecordId, Art } ordnet die Datei dem Datensatz zu.
 *
 * Löschen: action "delete" / resourcetype "fileRelation" mit
 *   { relationtype: "task", parentid, fileId }.
 *
 * Lesen: für Aufgaben NICHT dokumentiert. Für Objekte lautet das Muster
 * action "get" / resourcetype "file" / resourceid "estate" mit { estateid }.
 * readTaskFilesExperimental() probiert dasselbe Muster mit "task" aus – wenn
 * der Mandant antwortet, haben wir den Rückweg; wenn nicht, bleibt es bei der
 * einseitigen Spiegelung. Die Probe-Route berichtet das Ergebnis.
 */

import { call, elements, tryCall, type OnOfficeRecord } from "./client";
import { resolveTaskRelations } from "./relations";

export type FileModule = "estate" | "address" | "agentsLog" | "task";

export interface UploadResult {
  tmpUploadId: string;
  fileId?: string;
  bytes: number;
}

export interface OnofficeFile {
  fileId: string;
  fileName: string;
  originalName?: string;
  type?: string;
  sizeBytes?: number;
  url?: string;
  /** Base64-Inhalt, nur bei Einzelabfrage einer Datei. */
  content?: string;
}

/** Schritt 1: Datei in den Zwischenspeicher legen. */
export async function uploadToTemp(content: Buffer): Promise<string> {
  const res = await call({
    action: "do",
    resourceType: "uploadfile",
    parameters: { data: content.toString("base64") },
  });

  const record = (res.records as OnOfficeRecord[])[0];
  const e = elements(record ?? {});
  const tmpUploadId = String(e.tmpUploadId ?? e.tmpuploadid ?? record?.id ?? "").trim();

  if (!tmpUploadId) {
    throw new Error("onOffice hat keine tmpUploadId zurückgegeben.");
  }
  return tmpUploadId;
}

/**
 * Schritt 1 für große Dateien: blockweise. onOffice erlaubt das Anhängen
 * weiterer Blöcke an dieselbe tmpUploadId.
 */
export async function uploadToTempChunked(
  content: Buffer,
  chunkBytes = 4 * 1024 * 1024,
): Promise<string> {
  if (content.byteLength <= chunkBytes) return uploadToTemp(content);

  let tmpUploadId = "";
  for (let offset = 0; offset < content.byteLength; offset += chunkBytes) {
    const chunk = content.subarray(offset, Math.min(offset + chunkBytes, content.byteLength));
    const parameters: Record<string, unknown> = { data: chunk.toString("base64") };
    if (tmpUploadId) parameters.tmpUploadId = tmpUploadId;

    const res = await call({ action: "do", resourceType: "uploadfile", parameters });
    const e = elements((res.records as OnOfficeRecord[])[0] ?? {});
    tmpUploadId = String(e.tmpUploadId ?? e.tmpuploadid ?? tmpUploadId).trim();

    if (!tmpUploadId) throw new Error("Blockweiser Upload: keine tmpUploadId erhalten.");
  }
  return tmpUploadId;
}

/** Schritt 2: Zwischenspeicher-Datei einem Datensatz zuordnen. */
export async function attachTempFile(args: {
  tmpUploadId: string;
  module: FileModule;
  relatedRecordId: string | number;
  fileName: string;
  /** Dateityp in onOffice, z.B. "Dokument". */
  art?: string;
}): Promise<string | undefined> {
  const res = await call({
    action: "do",
    resourceType: "uploadfile",
    parameters: {
      tmpUploadId: args.tmpUploadId,
      module: args.module,
      relatedRecordId: String(args.relatedRecordId),
      file: args.fileName,
      Art: args.art ?? process.env.ONOFFICE_FILE_ART ?? "Dokument",
    },
  });

  const e = elements((res.records as OnOfficeRecord[])[0] ?? {});
  const fileId = String(e.fileId ?? e.fileid ?? e.id ?? "").trim();
  return fileId || undefined;
}

/** Beide Schritte in einem Aufruf: Datei an eine onOffice-Aufgabe hängen. */
export async function pushFileToTask(args: {
  taskId: string | number;
  fileName: string;
  content: Buffer;
  art?: string;
}): Promise<UploadResult> {
  const tmpUploadId = await uploadToTempChunked(args.content);
  const fileId = await attachTempFile({
    tmpUploadId,
    module: "task",
    relatedRecordId: args.taskId,
    fileName: args.fileName,
    art: args.art,
  });

  return { tmpUploadId, fileId, bytes: args.content.byteLength };
}

/** Datei an einer Aufgabe in onOffice löschen. */
export async function deleteTaskFile(args: {
  taskId: string | number;
  fileId: string | number;
}): Promise<void> {
  await call({
    action: "delete",
    resourceType: "fileRelation",
    parameters: {
      relationtype: "task",
      parentid: String(args.taskId),
      fileId: Number(args.fileId),
    },
  });
}

/** Dateien eines Objekts lesen – dieser Weg ist dokumentiert und geprüft. */
export async function readEstateFiles(estateId: string | number): Promise<OnofficeFile[]> {
  const res = await call({
    action: "get",
    resourceType: "file",
    resourceId: "estate",
    parameters: { estateid: Number(estateId) },
  });

  return (res.records as OnOfficeRecord[]).map(toFile);
}

/** Dateien eines Kundendatensatzes lesen. */
export async function readAddressFiles(addressId: string | number): Promise<OnofficeFile[]> {
  const res = await call({
    action: "get",
    resourceType: "file",
    resourceId: "address",
    parameters: { addressid: Number(addressId) },
  });

  return (res.records as OnOfficeRecord[]).map(toFile);
}

export interface RelatedFileGroup {
  kind: "estate" | "address";
  recordId: string;
  files: OnofficeFile[];
  error?: string;
}

/**
 * Dateien im Umfeld einer Aufgabe.
 *
 * WICHTIG für die Oberfläche: Das sind NICHT die Anhänge der Aufgabe – die
 * gibt die API nicht heraus. Es ist der Dateibestand des verknüpften Objekts
 * bzw. Kundendatensatzes, also bei einer Immobilie auch alle Objektfotos.
 * Entsprechend beschriften: "Dateien am verknüpften Objekt", nicht "Anhänge".
 * Aufgaben ohne Verknüpfung liefern eine leere Liste.
 */
export async function readFilesAroundTask(taskId: string | number): Promise<{
  groups: RelatedFileGroup[];
  total: number;
  hinweis: string;
}> {
  const { estateIds, addressIds } = await resolveTaskRelations(taskId);
  const groups: RelatedFileGroup[] = [];

  for (const id of estateIds) {
    try {
      groups.push({ kind: "estate", recordId: id, files: await readEstateFiles(id) });
    } catch (err) {
      groups.push({ kind: "estate", recordId: id, files: [], error: (err as Error).message });
    }
  }

  for (const id of addressIds) {
    try {
      groups.push({ kind: "address", recordId: id, files: await readAddressFiles(id) });
    } catch (err) {
      groups.push({ kind: "address", recordId: id, files: [], error: (err as Error).message });
    }
  }

  return {
    groups,
    total: groups.reduce((sum, g) => sum + g.files.length, 0),
    hinweis:
      "Dateien der verknüpften Datensätze, nicht die Anhänge der Aufgabe. " +
      "Aufgaben-Dateien gibt die onOffice-API nicht heraus.",
  };
}

/**
 * Versuch, die Dateien einer Aufgabe zu lesen. NICHT dokumentiert.
 * Wir probieren mehrere plausible Parameterformen und melden, was passiert –
 * wirft nicht, damit die Probe-Route sauber berichten kann.
 */
export async function readTaskFilesExperimental(taskId: string | number): Promise<{
  worked: boolean;
  variant?: string;
  files: OnofficeFile[];
  attempts: { variant: string; error: string }[];
}> {
  const variants: { name: string; parameters: Record<string, unknown> }[] = [
    { name: "resourceid=task, taskid", parameters: { taskid: Number(taskId) } },
    { name: "resourceid=task, recordid", parameters: { recordid: Number(taskId) } },
    { name: "resourceid=task, parentid", parameters: { parentid: Number(taskId) } },
  ];

  const attempts: { variant: string; error: string }[] = [];

  for (const variant of variants) {
    const res = await tryCall({
      action: "get",
      resourceType: "file",
      resourceId: "task",
      parameters: variant.parameters,
    });

    if (res.ok) {
      const files = (res.result.records as OnOfficeRecord[]).map(toFile);
      return { worked: true, variant: variant.name, files, attempts };
    }
    attempts.push({ variant: variant.name, error: res.error.message });
  }

  return { worked: false, files: [], attempts };
}

function toFile(record: OnOfficeRecord): OnofficeFile {
  const e = elements(record);
  const str = (key: string) => {
    const value = e[key];
    return value == null ? undefined : String(value).trim() || undefined;
  };

  return {
    fileId: String(record.id ?? e.fileId ?? e.id ?? ""),
    fileName: str("filename") ?? str("originalname") ?? "(ohne Namen)",
    originalName: str("originalname"),
    type: str("type"),
    sizeBytes: e.fileSize != null ? Number(e.fileSize) : undefined,
    url: str("url"),
    content: str("content"),
  };
}
