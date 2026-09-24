/**
 * Zustaendigkeit und Frist einer Asana-Aufgabe setzen.
 *
 * Der zweite Weg, auf dem das Tool nach Asana schreibt - und er
 * existiert aus einem einfachen Grund: wer hier zuteilt, ohne dass es
 * drueben ankommt, hat in zwei Minuten wieder den alten Stand. Asana
 * fuehrt bei diesen Feldern.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil } from "@/lib/supabase/profil";
import { asanaKonfiguriert, ruf } from "@/lib/asana/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  if (!["superadmin", "gf"].includes(profil.role)) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  if (!asanaKonfiguriert()) {
    return NextResponse.json(
      { fehler: "Asana ist in dieser Umgebung nicht eingerichtet." },
      { status: 503 },
    );
  }

  const { taskId, assigneeGid, dueOn } = (await request.json().catch(() => ({}))) as {
    taskId?: string;
    /** Leerer String heisst: niemand. */
    assigneeGid?: string | null;
    dueOn?: string | null;
  };

  if (!taskId) return NextResponse.json({ fehler: "taskId fehlt." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: aufgabe } = await sb
    .from("tasks")
    .select("id, asana_task_gid, title")
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe?.asana_task_gid) {
    return NextResponse.json({ fehler: "Diese Aufgabe kommt nicht aus Asana." }, { status: 404 });
  }

  const daten: Record<string, unknown> = {};
  if (assigneeGid !== undefined) daten.assignee = assigneeGid || null;
  if (dueOn !== undefined) daten.due_on = dueOn || null;

  if (!Object.keys(daten).length) {
    return NextResponse.json({ ok: true, meldung: "Nichts zu ändern." });
  }

  try {
    await ruf({ pfad: `/tasks/${aufgabe.asana_task_gid}`, methode: "PUT", daten });

    // Den hiesigen Stand gleich mitziehen, damit die Ansicht nicht bis
    // zum naechsten Abgleich etwas anderes zeigt als Asana.
    const zeile: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (assigneeGid !== undefined) {
      zeile.asana_assignee_gid = assigneeGid || null;
      const { data: wer } = assigneeGid
        ? await sb.from("asana_users").select("profile_id").eq("gid", assigneeGid).maybeSingle()
        : { data: null };
      zeile.assignee_id = wer?.profile_id ?? null;
    }
    if (dueOn !== undefined) zeile.due_date = dueOn || null;

    await sb.from("tasks").update(zeile).eq("id", aufgabe.id);

    return NextResponse.json({ ok: true, meldung: "In Asana eingetragen." });
  } catch (err) {
    return NextResponse.json({ fehler: (err as Error).message }, { status: 500 });
  }
}
