/**
 * Dateien an onOffice-Aufgaben.
 *
 * GET    ?taskId=123        – Versuch, die Dateien einer Aufgabe zu lesen
 *                             (undokumentiert, siehe Konzept). Meldet ehrlich,
 *                             ob es geht.
 * POST   { taskId, fileName, contentBase64 }
 *                           – Datei an die onOffice-Aufgabe hängen
 * DELETE ?taskId=123&fileId=456
 *                           – Datei an der Aufgabe in onOffice löschen
 */

import { NextResponse } from "next/server";
import { fail, guard } from "@/lib/api-guard";
import { deleteTaskFile, pushFileToTask, readTaskFilesExperimental } from "@/lib/onoffice/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Grenze für den Base64-Body; 25 MB Datei ergeben ca. 34 MB Base64. */
const MAX_BASE64_CHARS = 36 * 1024 * 1024;

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId) return fail("taskId ist erforderlich.", 400);

  try {
    const probe = await readTaskFilesExperimental(taskId);
    return NextResponse.json({
      ok: probe.worked,
      variant: probe.variant,
      files: probe.files,
      attempts: probe.worked ? undefined : probe.attempts,
      hinweis: probe.worked
        ? "Der Lesecall funktioniert in diesem Mandanten."
        : "Kein Lesecall für Aufgaben-Dateien verfügbar – Dateien aus onOffice bleiben dort.",
    });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  try {
    const body = (await request.json()) as {
      taskId?: string;
      fileName?: string;
      contentBase64?: string;
      art?: string;
    };

    if (!body.taskId || !body.fileName || !body.contentBase64) {
      return fail("taskId, fileName und contentBase64 sind erforderlich.", 400);
    }
    if (body.contentBase64.length > MAX_BASE64_CHARS) {
      return fail("Datei zu groß für diesen Weg.", 413);
    }

    const content = Buffer.from(body.contentBase64, "base64");
    if (!content.byteLength) return fail("contentBase64 ließ sich nicht dekodieren.", 400);

    const result = await pushFileToTask({
      taskId: body.taskId,
      fileName: body.fileName,
      content,
      art: body.art,
    });

    return NextResponse.json({
      ok: true,
      taskId: body.taskId,
      fileName: body.fileName,
      bytes: result.bytes,
      onofficeFileId: result.fileId,
      tmpUploadId: result.tmpUploadId,
    });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const params = new URL(request.url).searchParams;
  const taskId = params.get("taskId");
  const fileId = params.get("fileId");

  if (!taskId || !fileId) return fail("taskId und fileId sind erforderlich.", 400);

  try {
    await deleteTaskFile({ taskId, fileId });
    return NextResponse.json({ ok: true, taskId, fileId });
  } catch (err) {
    return fail(err);
  }
}
