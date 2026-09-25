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

  const { taskId, sectionGid, vorTaskId } = (await request.json().catch(() => ({}))) as {
    taskId?: string;
    sectionGid?: string;
    /**
     * Vor WELCHE Karte soll sie? Die eigene Aufgaben-ID der Karte,
     * ueber der losgelassen wurde. Fehlt sie, haengt die Karte unten an.
     */
    vorTaskId?: string;
  };

  if (!taskId || !sectionGid) {
    return NextResponse.json({ fehler: "taskId und sectionGid sind erforderlich." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const [{ data: aufgabe }, { data: spalte }] = await Promise.all([
    sb
      .from("tasks")
      .select("id, title, asana_task_gid, bereich, asana_rang, asana_eigene_rang")
      .eq("id", taskId)
      .maybeSingle(),
    sb.from("asana_sections").select("gid, name, ist_pool, bereich").eq("gid", sectionGid).maybeSingle(),
  ]);

  if (!aufgabe?.asana_task_gid) {
    return NextResponse.json({ fehler: "Diese Aufgabe kommt nicht aus Asana." }, { status: 404 });
  }
  if (!spalte) {
    return NextResponse.json({ fehler: "Diese Spalte gibt es nicht." }, { status: 404 });
  }

  const eigene = spalte.bereich === "eigene";
  const rangSpalte = eigene ? "asana_eigene_rang" : "asana_rang";
  const abschnittSpalte = eigene ? "asana_eigene_section_gid" : "asana_section_gid";

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
  /**
   * Wohin genau - die Nachbarn bestimmen den neuen Rang.
   *
   * Die Karten einer Spalte tragen Raenge im Abstand 100 (der Abgleich
   * vergibt sie). Wer zwischen zwei Karten faellt, bekommt die Mitte;
   * wer ganz nach oben soll, hundert weniger als die erste; wer unten
   * anhaengt, hundert mehr als die letzte. So bleibt die Reihenfolge
   * ohne Umnummerieren stabil - und ohne 40 Schreibvorgaenge je Zug.
   */
  const neuerRang = async (): Promise<{ rang: number; vorGid: string | null }> => {
    const { data: inSpalte } = await sb
      .from("tasks")
      .select(`id, asana_task_gid, ${rangSpalte}`)
      .eq(abschnittSpalte, sectionGid)
      .neq("id", aufgabe.id)
      .order(rangSpalte, { ascending: true, nullsFirst: false });

    const liste = (inSpalte ?? []) as unknown as {
      id: string;
      asana_task_gid: string | null;
      [k: string]: unknown;
    }[];
    const rangVon = (z: (typeof liste)[number]): number | null => {
      const w = z[rangSpalte];
      return typeof w === "number" ? w : null;
    };

    const stelle = vorTaskId ? liste.findIndex((z) => z.id === vorTaskId) : -1;

    // Ganz nach unten: hinter die letzte Karte.
    if (stelle < 0) {
      const letzte = rangVon(liste.at(-1) ?? ({} as (typeof liste)[number]));
      return { rang: (letzte ?? 0) + 100, vorGid: null };
    }

    const ziel = rangVon(liste[stelle]);
    const davor = stelle > 0 ? rangVon(liste[stelle - 1]) : null;

    if (ziel === null) return { rang: (davor ?? 0) + 100, vorGid: liste[stelle].asana_task_gid };
    if (davor === null) return { rang: ziel - 100, vorGid: liste[stelle].asana_task_gid };

    return { rang: (davor + ziel) / 2, vorGid: liste[stelle].asana_task_gid };
  };

  /**
   * Eine Karte verschieben - zweierlei, je nach Brett.
   *
   * Im Projekt legt man sie in eine Spalte (/sections/.../addTask), und
   * "insert_before" sagt, an welche Stelle. In "Meine Aufgaben" haengt
   * der Abschnitt an der Aufgabe selbst (assignee_section). Beides
   * verwechselt bekommt von Asana ein freundliches "nicht gefunden".
   */
  const schiebe = async (vorGid: string | null) => {
    if (eigene) {
      await ruf({
        pfad: `/tasks/${aufgabe.asana_task_gid}`,
        methode: "PUT",
        daten: { assignee_section: sectionGid },
      });
      // Die Feinsortierung in "Meine Aufgaben" kennt nicht jede
      // Asana-Umgebung. Klappt sie nicht, steht die Karte hier
      // trotzdem richtig - deshalb bewusst ohne Aufheben.
      if (vorGid) {
        try {
          await ruf({
            pfad: `/sections/${sectionGid}/addTask`,
            methode: "POST",
            daten: { task: aufgabe.asana_task_gid, insert_before: vorGid },
          });
        } catch {
          /* absichtlich leer */
        }
      }
      return;
    }
    await ruf({
      pfad: `/sections/${sectionGid}/addTask`,
      methode: "POST",
      daten: {
        task: aufgabe.asana_task_gid,
        ...(vorGid ? { insert_before: vorGid } : {}),
      },
    });
  };

  try {
    if (spalte.ist_pool) {
      // Erst drueben in die Pool-Spalte legen, dann hier abgeben. In
      // dieser Reihenfolge, damit die Karte in Asana nicht dort
      // stehenbleibt, wo sie war, wenn das Abgeben scheitert - dann
      // waere im Board nichts zu sehen und im Pool doch etwas.
      await schiebe(null);
      await gibAbAnDenPool(aufgabe.id, aufgabe.asana_task_gid, aufgabe.title, profil.id);

      return NextResponse.json({
        ok: true,
        abgegeben: true,
        meldung: `„${aufgabe.title}“ liegt jetzt im Aufgabenpool – in Asana steht sie im Pool-Abschnitt.`,
      });
    }

    const { rang, vorGid } = await neuerRang();
    await schiebe(vorGid);

    await sb
      .from("tasks")
      .update({
        [abschnittSpalte]: sectionGid,
        [rangSpalte]: rang,
        updated_at: new Date().toISOString(),
      })
      .eq("id", aufgabe.id);

    return NextResponse.json({
      ok: true,
      meldung: vorTaskId ? "Neu einsortiert." : `Verschoben nach „${spalte.name}“.`,
    });
  } catch (err) {
    return NextResponse.json({ fehler: (err as Error).message }, { status: 500 });
  }
}
