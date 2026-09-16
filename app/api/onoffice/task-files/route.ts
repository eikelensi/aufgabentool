/**
 * Dateien im Umfeld einer onOffice-Aufgabe.
 *
 *   GET /api/onoffice/task-files?taskId=21921
 *
 * Liefert die Verknüpfungen der Aufgabe und den Dateibestand der
 * verknüpften Objekte und Kundendatensätze. Die Anhänge der Aufgabe selbst
 * sind über die API nicht erreichbar – das ist geprüft, nicht vermutet.
 */

import { NextResponse } from "next/server";
import { fail, guard } from "@/lib/api-guard";
import { readFilesAroundTask } from "@/lib/onoffice/files";
import { resolveTaskRelations } from "@/lib/onoffice/relations";
import { addressDeeplink, estateDeeplink } from "@/lib/onoffice/records";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId) return fail("taskId ist erforderlich.", 400);

  try {
    const relations = await resolveTaskRelations(taskId);
    const { groups, total, hinweis } = await readFilesAroundTask(taskId);

    return NextResponse.json({
      ok: true,
      taskId,
      verknuepfungen: {
        objekte: relations.estateIds.map((id) => ({ id, link: estateDeeplink(id) })),
        kunden: relations.addressIds.map((id) => ({ id, link: addressDeeplink(id) })),
      },
      dateien: groups.map((g) => ({
        quelle: g.kind === "estate" ? "Objekt" : "Kunde",
        datensatz: g.recordId,
        anzahl: g.files.length,
        fehler: g.error,
        dateien: g.files.map((f) => ({
          fileId: f.fileId,
          name: f.originalName ?? f.fileName,
          bytes: f.sizeBytes,
          typ: f.type,
        })),
      })),
      gesamt: total,
      hinweis,
    });
  } catch (err) {
    return fail(err);
  }
}
