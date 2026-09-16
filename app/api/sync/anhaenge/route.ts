/**
 * Wartende Anhaenge nach onOffice spiegeln.
 *
 * Einbahnstrasse, und das ist keine Sparmassnahme: die onOffice-API gibt
 * die Dateien einer Aufgabe nicht heraus (file+task meldet Code 24,
 * fileRelation ist nicht lesbar). Hochladen und Loeschen gehen, Lesen
 * nicht. Fuehrende Ablage ist deshalb dieses Tool.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import { pushFileToTask } from "@/lib/onoffice/files";
import { onofficeConfigured } from "@/lib/onoffice/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRO_LAUF = 10;

async function darfLaufen(request: Request): Promise<boolean> {
  const geheim = process.env.INTERNAL_API_SECRET;
  const kopf = request.headers.get("x-api-secret");
  if (geheim && kopf && kopf === geheim) return true;

  const cron = request.headers.get("authorization");
  if (process.env.CRON_SECRET && cron === `Bearer ${process.env.CRON_SECRET}`) return true;

  return istAdmin(await aktuellesProfil());
}

export async function POST(request: Request) {
  if (!(await darfLaufen(request))) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  if (!onofficeConfigured()) {
    return NextResponse.json({
      pushed: 0,
      meldung: "onOffice-Zugangsdaten sind in dieser Umgebung nicht gesetzt.",
    });
  }

  const sb = supabaseAdmin();

  const { data: wartend, error } = await sb
    .from("task_attachments")
    .select("id, task_id, file_name, storage_path, onoffice_art, tasks ( onoffice_task_id )")
    .eq("sync_state", "wartet")
    .not("storage_path", "is", null)
    .limit(PRO_LAUF);

  if (error) return NextResponse.json({ fehler: error.message }, { status: 500 });

  let pushed = 0;
  let uebersprungen = 0;
  const fehler: string[] = [];

  for (const a of wartend ?? []) {
    const onofficeTaskId = (a.tasks as unknown as { onoffice_task_id: string | null } | null)
      ?.onoffice_task_id;

    // Ohne Gegenstueck in onOffice gibt es kein Ziel fuer die Datei.
    if (!onofficeTaskId) {
      uebersprungen++;
      await sb.from("task_attachments").update({ sync_state: "lokal" }).eq("id", a.id);
      continue;
    }

    try {
      const { data: datei, error: ladeFehler } = await sb.storage
        .from("task-attachments")
        .download(a.storage_path as string);

      if (ladeFehler || !datei) throw new Error(ladeFehler?.message ?? "Datei nicht lesbar");

      const inhalt = Buffer.from(await datei.arrayBuffer());

      const ergebnis = await pushFileToTask({
        taskId: onofficeTaskId,
        fileName: a.file_name,
        content: inhalt,
        art: a.onoffice_art ?? undefined,
      });

      await sb
        .from("task_attachments")
        .update({
          sync_state: "synchron",
          onoffice_file_id: ergebnis.fileId ?? null,
          sync_error: null,
          synced_at: new Date().toISOString(),
        })
        .eq("id", a.id);

      pushed++;
    } catch (err) {
      const meldung = (err as Error).message;
      fehler.push(`${a.file_name}: ${meldung}`);
      await sb
        .from("task_attachments")
        .update({ sync_state: "fehler", sync_error: meldung })
        .eq("id", a.id);
    }
  }

  await sb.from("onoffice_sync_log").insert({
    direction: "push",
    resource: "file",
    ok: fehler.length === 0,
    message: `${pushed} übertragen, ${uebersprungen} ohne onOffice-Aufgabe, ${fehler.length} Fehler`,
    payload: { fehler: fehler.slice(0, 10) },
  });

  const teile = [`${pushed} Datei(en) nach onOffice übertragen`];
  if (uebersprungen) {
    teile.push(
      `${uebersprungen} übersprungen, weil die Aufgabe kein Gegenstück in onOffice hat`,
    );
  }
  if (fehler.length) teile.push(`Fehler: ${fehler.slice(0, 3).join("; ")}`);

  return NextResponse.json({ pushed, uebersprungen, fehler, meldung: teile.join(". ") });
}

export const GET = POST;
