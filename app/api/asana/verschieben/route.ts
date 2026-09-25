/**
 * Eine Karte im Asana-Board in eine andere Spalte legen.
 *
 * Der eine Weg, auf dem das Tool nach Asana schreibt. Sonst fuehrt
 * Asana - aber eine Karte, die sich hier nicht schieben laesst, waere
 * ein Bild und kein Board.
 *
 * Landet sie in der Pool-Spalte, passiert mehr als ein Spaltenwechsel:
 * die Aufgabe verlaesst den Bereich der Geschaeftsfuehrung, geht in den
 * Aufgabenpool, verschwindet aus Asana und meldet sich bei GF und QM.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil } from "@/lib/supabase/profil";
import { asanaKonfiguriert, ruf } from "@/lib/asana/client";
import { gibAbAnDenPool } from "@/lib/sync/asana";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  // Der Projektbereich gehoert der Geschaeftsfuehrung. Die
  // persoenlichen Aufgaben gehoeren genau einem Menschen - dem, dessen
  // Zugriffstoken in ASANA_TOKEN steht. Das Tool kann nicht pruefen,
  // wer das ist; es kann nur den Kreis so eng ziehen, dass nur einer
  // darin steht.
  if (!["superadmin", "gf"].includes(profil.role)) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  if (!asanaKonfiguriert()) {
    return NextResponse.json({ fehler: "Asana ist in dieser Umgebung nicht eingerichtet." }, { status: 503 });
  }

  const { taskId, sectionGid } = (await request.json().catch(() => ({}))) as {
    taskId?: string;
    sectionGid?: string;
  };

  if (!taskId || !sectionGid) {
    return NextResponse.json({ fehler: "taskId und sectionGid sind erforderlich." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const [{ data: aufgabe }, { data: spalte }] = await Promise.all([
    sb.from("tasks").select("id, title, asana_task_gid, bereich").eq("id", taskId).maybeSingle(),
    sb.from("asana_sections").select("gid, name, ist_pool, bereich").eq("gid", sectionGid).maybeSingle(),
  ]);

  if (!aufgabe?.asana_task_gid) {
    return NextResponse.json({ fehler: "Diese Aufgabe kommt nicht aus Asana." }, { status: 404 });
  }
  if (!spalte) {
    return NextResponse.json({ fehler: "Diese Spalte gibt es nicht." }, { status: 404 });
  }

  const eigene = spalte.bereich === "eigene";

  if (eigene && profil.role !== "superadmin") {
    return NextResponse.json(
      { fehler: "Die persönlichen Asana-Aufgaben gehören nicht dir." },
      { status: 403 },
    );
  }

  /**
   * Eine Karte verschieben - zweierlei, je nach Brett.
   *
   * Im Projekt legt man sie in eine Spalte (/sections/.../addTask).
   * In "Meine Aufgaben" gibt es keine Spalten, sondern einen
   * Abschnitt AN DER AUFGABE: assignee_section. Derselbe Handgriff,
   * zwei Aufrufe - wer das verwechselt, bekommt von Asana ein
   * freundliches "nicht gefunden" und wundert sich.
   */
  const schiebe = async () => {
    if (eigene) {
      await ruf({
        pfad: `/tasks/${aufgabe.asana_task_gid}`,
        methode: "PUT",
        daten: { assignee_section: sectionGid },
      });
      return;
    }
    await ruf({
      pfad: `/sections/${sectionGid}/addTask`,
      methode: "POST",
      daten: { task: aufgabe.asana_task_gid },
    });
  };

  try {
    if (spalte.ist_pool) {
      // Erst drueben in die Pool-Spalte legen, dann hier abgeben. In
      // dieser Reihenfolge, damit die Karte in Asana nicht dort
      // stehenbleibt, wo sie war, wenn das Abgeben scheitert - dann
      // waere im Board nichts zu sehen und im Pool doch etwas.
      await schiebe();
      await gibAbAnDenPool(aufgabe.id, aufgabe.asana_task_gid, aufgabe.title, profil.id);

      return NextResponse.json({
        ok: true,
        abgegeben: true,
        meldung: `„${aufgabe.title}“ liegt jetzt im Aufgabenpool – in Asana steht sie im Pool-Abschnitt.`,
      });
    }

    await schiebe();

    await sb
      .from("tasks")
      .update({
        ...(eigene
          ? { asana_eigene_section_gid: sectionGid }
          : { asana_section_gid: sectionGid }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", aufgabe.id);

    return NextResponse.json({ ok: true, meldung: `Verschoben nach „${spalte.name}“.` });
  } catch (err) {
    return NextResponse.json({ fehler: (err as Error).message }, { status: 500 });
  }
}
