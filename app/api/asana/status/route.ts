/**
 * Eine Aufgabe in Asana abhaken - oder wieder aufmachen.
 *
 * Gebraucht fuer den Weg, den eine abgegebene Aufgabe nimmt: aus dem
 * Asana-Pool in den Aufgabenpool, von dort zieht sie sich jemand, und
 * wenn er sie erledigt, muss das auch drueben stehen. Sonst haengt in
 * Asana bis in alle Ewigkeit eine Karte in der Pool-Spalte, von der
 * niemand weiss, dass sie laengst fertig ist.
 *
 * Gilt fuer JEDE Aufgabe mit Asana-Nummer, nicht nur fuer die im
 * Asana-Bereich: die abgegebenen sind ja gerade die, um die es geht.
 * Deshalb hier auch keine Beschraenkung auf die Geschaeftsfuehrung -
 * erledigen darf, wer die Aufgabe hat.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import { asanaKonfiguriert, ruf } from "@/lib/asana/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  if (!asanaKonfiguriert()) {
    return NextResponse.json({ uebertragen: false, meldung: "Asana ist nicht eingerichtet." });
  }

  const { taskId, erledigt } = (await request.json().catch(() => ({}))) as {
    taskId?: string;
    erledigt?: boolean;
  };

  if (!taskId || typeof erledigt !== "boolean") {
    return NextResponse.json({ fehler: "taskId und erledigt sind erforderlich." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: aufgabe } = await sb
    .from("tasks")
    .select("id, title, asana_task_gid, assignee_id, creator_id")
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe?.asana_task_gid) {
    return NextResponse.json({ uebertragen: false, meldung: "Keine Asana-Aufgabe." });
  }

  const darf =
    aufgabe.assignee_id === profil.id || aufgabe.creator_id === profil.id || istAdmin(profil);
  if (!darf) return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });

  try {
    await ruf({
      pfad: `/tasks/${aufgabe.asana_task_gid}`,
      methode: "PUT",
      daten: { completed: erledigt },
    });

    return NextResponse.json({
      uebertragen: true,
      meldung: erledigt ? "In Asana abgehakt." : "In Asana wieder geöffnet.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        uebertragen: false,
        meldung: `Im Tool erledigt, Asana hat es aber abgelehnt: ${(err as Error).message}`,
      },
      { status: 207 },
    );
  }
}
