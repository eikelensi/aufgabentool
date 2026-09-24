/**
 * Eine Notiz als Kommentar nach Asana schreiben.
 *
 * Gilt fuer JEDE Aufgabe mit Asana-Nummer, auch fuer die laengst
 * abgegebenen im Aufgabenpool: gerade bei denen ist die Rueckmeldung
 * das Wichtigste. In Asana steht die Karte in der Pool-Spalte, und wer
 * dort nachsieht, soll lesen koennen, was der Kollege im Tool dazu
 * geschrieben hat.
 *
 * Der Kniff steckt am Ende: die Nummer, die Asana fuer den neuen
 * Kommentar zurueckgibt, wird an der Notiz gespeichert. Damit kennt
 * der Abgleich sie schon und holt sie nicht als neue Notiz zurueck -
 * sonst stuende jede Notiz nach zwei Minuten doppelt im Verlauf.
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

  const { taskId, noteId } = (await request.json().catch(() => ({}))) as {
    taskId?: string;
    noteId?: string;
  };

  if (!taskId) return NextResponse.json({ fehler: "taskId fehlt." }, { status: 400 });

  if (!asanaKonfiguriert()) {
    return NextResponse.json({ uebertragen: false, meldung: "Asana ist nicht eingerichtet." });
  }

  const sb = supabaseAdmin();

  const { data: aufgabe } = await sb
    .from("tasks")
    .select("id, title, asana_task_gid, assignee_id, creator_id, is_private")
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe?.asana_task_gid) {
    return NextResponse.json({ uebertragen: false, meldung: "Keine Asana-Aufgabe." });
  }
  if (aufgabe.is_private) {
    return NextResponse.json({ uebertragen: false, meldung: "Private Aufgaben bleiben im Tool." });
  }

  const darf =
    aufgabe.assignee_id === profil.id || aufgabe.creator_id === profil.id || istAdmin(profil);
  if (!darf) return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });

  // Die gemeinte Notiz, oder die neueste, die noch nicht drueben ist.
  // Notizen, die AUS Asana kamen, tragen schon eine Kommentarnummer -
  // die schicken wir nicht zurueck.
  const abfrage = sb
    .from("task_notes")
    .select("id, body, author_id, profiles ( full_name )")
    .eq("task_id", taskId)
    .is("asana_comment_gid", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: notizen } = noteId
    ? await sb
        .from("task_notes")
        .select("id, body, author_id, profiles ( full_name )")
        .eq("id", noteId)
        .is("asana_comment_gid", null)
        .limit(1)
    : await abfrage;

  const notiz = notizen?.[0];
  if (!notiz) {
    return NextResponse.json({ uebertragen: false, meldung: "Nichts zu übertragen." });
  }

  const wer = (notiz.profiles as unknown as { full_name?: string } | null)?.full_name ?? profil.fullName;

  try {
    const story = await ruf<{ gid: string }>({
      pfad: `/tasks/${aufgabe.asana_task_gid}/stories`,
      methode: "POST",
      daten: { text: `${wer}: ${String(notiz.body).trim()}` },
    });

    if (story?.gid) {
      await sb.from("task_notes").update({ asana_comment_gid: story.gid }).eq("id", notiz.id);
    }

    return NextResponse.json({ uebertragen: true, meldung: "Als Kommentar in Asana hinterlegt." });
  } catch (err) {
    return NextResponse.json(
      {
        uebertragen: false,
        meldung: `Die Notiz steht im Tool, Asana hat sie abgelehnt: ${(err as Error).message}`,
      },
      { status: 207 },
    );
  }
}
