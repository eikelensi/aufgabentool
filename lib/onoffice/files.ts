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
 * Lesen (22.09.2026 gefunden, zweistufig):
 *   1. action "get" / resourcetype "idsfromrelation" mit relationtype
 *      task:file:attachment -> die Datei-IDs der Aufgabe.
 *   2. action "get" / resourcetype "file" mit { fileid } -> Name, Typ und
 *      der Inhalt als base64.
 * Der frühere Fehlschlag (Code 24) lag nicht daran, dass Aufgaben-Dateien
 * gesperrt wären, sondern daran, dass wir "file" nach einer taskid gefragt
 * haben. "file" kennt nur fileids.
 */

import { call, elements, tryCall, type OnOfficeRecord } from "./client";
import { resolveTaskRelations, taskFileIds } from "./relations";

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
 * holt readTaskAttachments(). Es ist der Dateibestand des verknüpften Objekts
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
      "Die Anhänge der Aufgabe selbst stehen in readTaskAttachments().",
  };
}

/**
 * Eine einzelne Datei samt Inhalt holen.
 *
 * Welche resourceid der Mandant für Aufgaben-Dateien erwartet, ist nicht
 * dokumentiert. Wir probieren der Reihe nach und merken uns, was geklappt
 * hat – danach kostet jede weitere Datei nur noch einen Aufruf.
 */
const WEGE = ["task", "estate", "address"] as const;
let gemerkterWeg: (typeof WEGE)[number] | null = null;

export interface DateiMitInhalt {
  datei: OnofficeFile;
  inhalt: Buffer;
  weg: string;
}

export async function ladeDatei(fileId: string | number): Promise<DateiMitInhalt | null> {
  const reihenfolge = gemerkterWeg
    ? [gemerkterWeg, ...WEGE.filter((w) => w !== gemerkterWeg)]
    : [...WEGE];

  let letzterFehler = "";

  for (const weg of reihenfolge) {
    const res = await tryCall({
      action: "get",
      resourceType: "file",
      resourceId: weg,
      parameters: { fileid: Number(fileId), includeImageUrl: "original" },
    });

    if (!res.ok) {
      letzterFehler = res.error.message;
      continue;
    }

    const record = (res.result.records as OnOfficeRecord[])[0];
    if (!record) {
      letzterFehler = "keine Antwortdaten";
      continue;
    }

    gemerkterWeg = weg;
    const datei = toFile(record);

    // Bevorzugt der mitgelieferte base64-Inhalt. Fehlt er, laden wir über
    // die Adresse nach - bei Bildern liefert onOffice nur diese.
    if (datei.content) {
      return { datei, inhalt: Buffer.from(datei.content, "base64"), weg };
    }

    if (datei.url) {
      const antwort = await fetch(datei.url);
      if (!antwort.ok) {
        throw new Error(`Datei ${fileId}: Download fehlgeschlagen (${antwort.status}).`);
      }
      return { datei, inhalt: Buffer.from(await antwort.arrayBuffer()), weg };
    }

    throw new Error(`Datei ${fileId}: onOffice liefert weder Inhalt noch Adresse.`);
  }

  throw new Error(`Datei ${fileId} nicht lesbar: ${letzterFehler || "unbekannter Grund"}`);
}

/** Die Anhänge EINER Aufgabe, nur die Beschreibung, ohne Inhalt. */
export async function readTaskAttachments(taskId: string | number): Promise<OnofficeFile[]> {
  const proAufgabe = await taskFileIds([taskId]);
  const ids = proAufgabe.get(String(taskId)) ?? [];

  const dateien: OnofficeFile[] = [];
  for (const id of ids) {
    const res = await tryCall({
      action: "get",
      resourceType: "file",
      resourceId: gemerkterWeg ?? "task",
      parameters: { fileid: Number(id) },
    });
    const record = res.ok ? (res.result.records as OnOfficeRecord[])[0] : undefined;
    dateien.push(record ? toFile(record) : { fileId: id, fileName: `Datei ${id}` });
  }

  return dateien;
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
