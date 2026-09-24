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
import { synchronisiereAsana } from "@/lib/sync/asana";

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

    // Gleich holen, damit die Karte sofort im Board steht.
    const ergebnis = await synchronisiereAsana();

    return NextResponse.json({
      ok: true,
      asanaTaskGid: neu.gid,
      meldung: `„${titel.trim()}“ in Asana angelegt.`,
      abgleich: ergebnis.meldung,
    });
  } catch (err) {
    return NextResponse.json({ fehler: (err as Error).message }, { status: 500 });
  }
}
