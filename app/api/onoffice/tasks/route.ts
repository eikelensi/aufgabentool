/**
 * GET  – Aufgaben aus onOffice lesen (Filter: processor, modifiedSince, limit)
 * POST – Aufgabe in onOffice anlegen oder deren Status zurückschreiben
 *
 * Solange Supabase nicht angebunden ist, liefert GET die onOffice-Daten
 * unverändert zurück. Der Abgleich mit unserer Tabelle kommt im nächsten
 * Schritt dazu; die Zuordnung läuft dann über tasks.onoffice_task_id.
 */

import { NextResponse } from "next/server";
import { fail, guard } from "@/lib/api-guard";
import { createTask, pushStatus, readTasks } from "@/lib/onoffice/tasks";
import { pruefeSchreibsperre } from "@/lib/onoffice/schreibsperre";
import type { TaskStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  const url = new URL(request.url);

  try {
    const { tasks, total } = await readTasks({
      processor: url.searchParams.get("processor") ?? undefined,
      modifiedSince: url.searchParams.get("modifiedSince") ?? undefined,
      relatedEstateId: url.searchParams.get("estateId") ?? undefined,
      relatedAddressId: url.searchParams.get("addressId") ?? undefined,
      listLimit: Number(url.searchParams.get("limit") ?? 100),
      listOffset: Number(url.searchParams.get("offset") ?? 0),
    });

    return NextResponse.json({ ok: true, total, count: tasks.length, tasks });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  // Diese Route ist das Werkzeug, mit dem von Hand geschrieben wird -
  // mit dem Geheimnis im Kopf, nicht aus der Oberflaeche. Der
  // Hauptschalter gilt auch hier: sonst haette sync_read_only eine
  // Hintertuer, und ein Schalter mit Hintertuer ist keiner.
  const sperre = await pruefeSchreibsperre("status");
  if (!sperre.erlaubt) {
    return NextResponse.json({ ok: false, fehler: sperre.grund }, { status: 409 });
  }

  try {
    const body = (await request.json()) as {
      mode?: "create" | "status";
      taskId?: string;
      status?: TaskStatus;
      comment?: string;
      subject?: string;
      description?: string;
      processor?: string;
      responsibility?: string;
      deadline?: string;
      startDate?: string;
      estateId?: string;
      addressId?: string;
    };

    if (body.mode === "status") {
      if (!body.taskId || !body.status) {
        return fail("taskId und status sind erforderlich.", 400);
      }
      await pushStatus(body.taskId, body.status, body.comment);
      return NextResponse.json({ ok: true, taskId: body.taskId, status: body.status });
    }

    if (!body.subject) return fail("subject ist erforderlich.", 400);

    const id = await createTask({
      subject: body.subject,
      description: body.description,
      processor: body.processor,
      responsibility: body.responsibility,
      startDate: body.startDate ?? null,
      deadline: body.deadline ?? null,
      comment: body.comment,
      relatedEstateId: body.estateId,
      relatedAddressId: body.addressId,
    });

    return NextResponse.json({ ok: true, taskId: id });
  } catch (err) {
    return fail(err);
  }
}
