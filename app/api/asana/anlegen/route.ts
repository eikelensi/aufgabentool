/**
 * Eine Aufgabe im Asana-Bereich anlegen.
 *
 * Angelegt wird in ASANA, nicht hier - und der Abgleich holt sie
 * anschliessend herueber. Das ist ein Umweg von hoechstens zwei
 * Minuten, aber er hat einen Grund: legte das Tool sie zuerst bei sich
 * an, gaebe es fuer einen Moment zwei Wahrheiten, und beim naechsten
 * Lauf muesste geraten werden, welche die richtige ist. In diesem
 * Bereich fuehrt Asana, auch beim Entstehen.
 *
 * Damit die Karte nicht erst beim naechsten Lauf auftaucht, wird sie
 * gleich mitgespiegelt.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil } from "@/lib/supabase/profil";
import { asanaKonfiguriert, projektGid, ruf } from "@/lib/asana/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const { titel, beschreibung, sectionGid, assigneeGid, dueOn } = (await request
    .json()
    .catch(() => ({}))) as {
    titel?: string;
    beschreibung?: string;
    sectionGid?: string;
    assigneeGid?: string | null;
    dueOn?: string | null;
  };

  if (!titel?.trim()) {
    return NextResponse.json({ fehler: "Ohne Titel geht es nicht." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // Ohne Spalte landet die Aufgabe in Asana irgendwo. Also die erste
  // Spalte, die nicht der Pool ist - dort faengt Arbeit an, nicht im
  // Ausgang.
  let ziel = sectionGid;
  if (!ziel) {
    const { data } = await sb
      .from("asana_sections")
      .select("gid")
      .eq("ist_pool", false)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    ziel = data?.gid;
  }

  try {
    const neu = await ruf<{ gid: string }>({
      pfad: "/tasks",
      methode: "POST",
      daten: {
        name: titel.trim(),
        notes: beschreibung?.trim() || "",
        projects: [projektGid()],
        assignee: assigneeGid || null,
        due_on: dueOn || null,
      },
    });

    if (ziel) {
      await ruf({
        pfad: `/sections/${ziel}/addTask`,
        methode: "POST",
        daten: { task: neu.gid },
      });
    }

    // Die Karte gleich selbst eintragen, statt den ganzen Abgleich
    // laufen zu lassen. Der brauchte fuer dreiundvierzig Aufgaben und
    // ihre Kommentare so lange, dass die Anfrage in die Zeitgrenze
    // lief - und das Fenster offen blieb, obwohl die Aufgabe in Asana
    // schon stand. Was hier fehlt, ergaenzt der naechste Lauf in
    // hoechstens einer Minute.
    const { data: wer } = assigneeGid
      ? await sb.from("asana_users").select("profile_id").eq("gid", assigneeGid).maybeSingle()
      : { data: null };

    const { data: angelegt, error } = await sb
      .from("tasks")
      .insert({
        title: titel.trim(),
        description: beschreibung?.trim() || null,
        status: "offen",
        priority: "normal",
        bereich: "asana",
        asana_task_gid: neu.gid,
        asana_section_gid: ziel ?? null,
        asana_assignee_gid: assigneeGid || null,
        assignee_id: wer?.profile_id ?? null,
        creator_id: profil.id,
        due_date: dueOn || null,
        visible_from: new Date().toISOString().slice(0, 10),
        source: "manuell",
        is_pool: false,
        updated_by: profil.id,
      })
      .select("id")
      .single();

    return NextResponse.json({
      ok: true,
      asanaTaskGid: neu.gid,
      taskId: angelegt?.id ?? null,
      meldung: error
        ? `In Asana angelegt. Im Tool erscheint sie mit dem nächsten Abgleich (${error.message}).`
        : `„${titel.trim()}“ in Asana angelegt.`,
    });
  } catch (err) {
    return NextResponse.json({ fehler: (err as Error).message }, { status: 500 });
  }
}
