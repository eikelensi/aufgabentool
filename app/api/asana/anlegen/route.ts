/**
 * Eine Aufgabe im Asana-Bereich anlegen.
 *
 * Angelegt wird in ASANA, nicht hier - und der Abgleich holt sie
 * anschliessend herueber. Das ist ein Umweg, aber er hat einen Grund:
 * legte das Tool sie zuerst bei sich an, gaebe es fuer einen Moment
 * zwei Wahrheiten, und beim naechsten Lauf muesste geraten werden,
 * welche die richtige ist. In diesem Bereich fuehrt Asana, auch beim
 * Entstehen.
 *
 * Zwei Bretter, zwei Wege:
 *
 *   projekt  - die Aufgabe gehoert ins Projekt der Geschaeftsfuehrung
 *              und in eine seiner Spalten.
 *   eigene   - die Aufgabe gehoert in "Meine Aufgaben". Dort gibt es
 *              keine Projektspalten, sondern einen Abschnitt AN der
 *              Aufgabe (assignee_section), und sie braucht einen
 *              Zustaendigen, sonst taucht sie in keiner Liste auf.
 *
 * Wer das verwechselt, legt Aufgaben im falschen Brett an - und genau
 * das ist passiert, solange die Route das Brett gar nicht kannte.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil } from "@/lib/supabase/profil";
import { asanaKonfiguriert, projektGid, ruf, workspaceGid } from "@/lib/asana/client";

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

  const { titel, beschreibung, sectionGid, assigneeGid, dueOn, bereich } = (await request
    .json()
    .catch(() => ({}))) as {
    titel?: string;
    beschreibung?: string;
    sectionGid?: string;
    assigneeGid?: string | null;
    dueOn?: string | null;
    bereich?: "projekt" | "eigene";
  };

  if (!titel?.trim()) {
    return NextResponse.json({ fehler: "Ohne Titel geht es nicht." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  /**
   * Welches Brett, und welche Spalte darin?
   *
   * Wenn eine Spalte genannt ist, entscheidet SIE ueber das Brett -
   * sie kann nur zu einem gehoeren. Sonst zaehlt, was die Oberflaeche
   * sagt, und im Zweifel das Projekt.
   */
  let brett: "projekt" | "eigene" = bereich === "eigene" ? "eigene" : "projekt";
  let ziel = sectionGid;

  if (ziel) {
    const { data } = await sb
      .from("asana_sections")
      .select("gid, bereich, ist_pool")
      .eq("gid", ziel)
      .maybeSingle();
    if (data?.bereich === "eigene" || data?.bereich === "projekt") brett = data.bereich;
    // In den Pool legt man nichts an - das ist der Ausgang.
    if (data?.ist_pool) ziel = undefined;
  }

  if (!ziel) {
    // Der Eingang des Bretts. Frueher stand hier "die erste Spalte,
    // die nicht der Pool ist" - und weil der Pool damals ganz links
    // stand, war das eine Zufallsauswahl. Jetzt ist der Eingang
    // ausdruecklich markiert.
    const { data } = await sb
      .from("asana_sections")
      .select("gid")
      .eq("bereich", brett)
      .eq("ist_eingang", true)
      .maybeSingle();

    ziel = data?.gid;

    if (!ziel) {
      const { data: ersatz } = await sb
        .from("asana_sections")
        .select("gid")
        .eq("bereich", brett)
        .eq("ist_pool", false)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      ziel = ersatz?.gid;
    }
  }

  const rangSpalte = brett === "eigene" ? "asana_eigene_rang" : "asana_rang";
  const abschnittSpalte = brett === "eigene" ? "asana_eigene_section_gid" : "asana_section_gid";

  /**
   * Ganz nach oben - in Asana wie hier.
   *
   * Asana haengt eine Aufgabe ans ENDE des Abschnitts. Neues soll aber
   * oben stehen, sonst sieht man es nicht. "insert_before" braucht
   * dafuer die oberste Karte des Abschnitts; die kennen wir aus
   * unserer eigenen Reihenfolge und muessen Asana nicht danach fragen.
   */
  const { data: oberste } = ziel
    ? await sb
        .from("tasks")
        .select(`asana_task_gid, ${rangSpalte}`)
        .eq(abschnittSpalte, ziel)
        .not("asana_task_gid", "is", null)
        .order(rangSpalte, { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const obersteZeile = oberste as { asana_task_gid?: string | null; [k: string]: unknown } | null;
  const obersterRang =
    typeof obersteZeile?.[rangSpalte] === "number" ? (obersteZeile[rangSpalte] as number) : null;
  const neuerRang = (obersterRang ?? 100) - 100;

  try {
    // Im eigenen Brett braucht die Aufgabe einen Zustaendigen, sonst
    // steht sie in niemandes Liste. Ohne Angabe: der, dessen Token
    // gerade schreibt.
    const zustaendig = brett === "eigene" ? assigneeGid || "me" : assigneeGid || null;

    const neu = await ruf<{ gid: string }>({
      pfad: "/tasks",
      methode: "POST",
      daten:
        brett === "eigene"
          ? {
              name: titel.trim(),
              notes: beschreibung?.trim() || "",
              workspace: workspaceGid(),
              assignee: zustaendig,
              due_on: dueOn || null,
            }
          : {
              name: titel.trim(),
              notes: beschreibung?.trim() || "",
              projects: [projektGid()],
              assignee: zustaendig,
              due_on: dueOn || null,
            },
    });

    if (ziel) {
      if (brett === "eigene") {
        // In "Meine Aufgaben" haengt der Abschnitt an der Aufgabe.
        await ruf({
          pfad: `/tasks/${neu.gid}`,
          methode: "PUT",
          daten: { assignee_section: ziel },
        });
      }
      // Fuer beide Bretter: einsortieren, und zwar nach oben. Im
      // eigenen Brett kennt das nicht jede Asana-Umgebung, deshalb
      // dort ohne Aufheben.
      try {
        await ruf({
          pfad: `/sections/${ziel}/addTask`,
          methode: "POST",
          daten: {
            task: neu.gid,
            ...(obersteZeile?.asana_task_gid
              ? { insert_before: obersteZeile.asana_task_gid }
              : {}),
          },
        });
      } catch (err) {
        if (brett === "projekt") throw err;
      }
    }

    // Die Karte gleich selbst eintragen, statt den ganzen Abgleich
    // laufen zu lassen. Der brauchte fuer dreiundvierzig Aufgaben und
    // ihre Kommentare so lange, dass die Anfrage in die Zeitgrenze
    // lief - und das Fenster offen blieb, obwohl die Aufgabe in Asana
    // schon stand. Was hier fehlt, ergaenzt der naechste Lauf.
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
        [abschnittSpalte]: ziel ?? null,
        [rangSpalte]: neuerRang,
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
      bereich: brett,
      sectionGid: ziel ?? null,
      rang: neuerRang,
      meldung: error
        ? `In Asana angelegt. Im Tool erscheint sie mit dem nächsten Abgleich (${error.message}).`
        : `„${titel.trim()}“ in Asana angelegt.`,
    });
  } catch (err) {
    return NextResponse.json({ fehler: (err as Error).message }, { status: 500 });
  }
}
