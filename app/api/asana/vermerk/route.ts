/**
 * Den Lebenslauf einer Aufgabe in Asana mitschreiben.
 *
 * Wer eine Aufgabe aus dem Pool zieht, sie zurueckgibt oder erledigt,
 * tut das im Aufgabentool. In Asana sieht man davon nichts - die Karte
 * steht dort in der Pool-Spalte und schweigt. Also schreiben wir es
 * hin, als Kommentar an der Aufgabe: verteilt an wen, wann
 * zurueckgegeben, von wem erledigt.
 *
 * Bewusst ein Kommentar und kein Feld: es ist eine Chronik, und eine
 * Chronik ueberschreibt man nicht. Wer in Asana auf die Karte schaut,
 * soll lesen koennen, was mit ihr passiert ist, ohne ins Tool zu
 * wechseln.
 *
 * Fehler sind hier nie schlimm genug, um eine Aktion zu verhindern:
 * wer sich eine Aufgabe zieht, hat sie gezogen, auch wenn Asana
 * gerade nicht antwortet.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil } from "@/lib/supabase/profil";
import { asanaKonfiguriert, ruf } from "@/lib/asana/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export type Anlass = "verteilt" | "pool" | "erledigt" | "geoeffnet";

function jetzt(): string {
  return new Date().toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  const { taskId, anlass, grund, erneut: erneutVomAufrufer } = (await request
    .json()
    .catch(() => ({}))) as {
    taskId?: string;
    anlass?: Anlass;
    grund?: string;
    /** War die Aufgabe schon einmal im Pool? Der Aufrufer weiss das
     *  noch; in der Datenbank ist der Vermerk beim Uebernehmen
     *  bereits geloescht. */
    erneut?: boolean;
  };

  if (!taskId || !anlass) {
    return NextResponse.json({ fehler: "taskId und anlass sind erforderlich." }, { status: 400 });
  }

  if (!asanaKonfiguriert()) {
    return NextResponse.json({ vermerkt: false, meldung: "Asana ist nicht eingerichtet." });
  }

  const sb = supabaseAdmin();
  const { data: aufgabe } = await sb
    .from("tasks")
    .select("id, title, asana_task_gid, assignee_id, pool_zurueck_am")
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe?.asana_task_gid) {
    return NextResponse.json({ vermerkt: false, meldung: "Keine Asana-Aufgabe." });
  }

  // Wer gerade zustaendig ist - fuer "verteilt an" ist das die
  // Nachricht, fuer die uebrigen Anlaesse zaehlt, wer gehandelt hat.
  let bearbeiter = profil.fullName;
  if (aufgabe.assignee_id) {
    const { data: wer } = await sb
      .from("profiles")
      .select("full_name")
      .eq("id", aufgabe.assignee_id)
      .maybeSingle();
    bearbeiter = wer?.full_name ?? bearbeiter;
  }

  // "Erneut verteilt" nur, wenn die Aufgabe schon einmal zurueckkam -
  // sonst liest es sich, als haette es eine Vorgeschichte, die es
  // nicht gibt.
  const erneut = erneutVomAufrufer ?? Boolean(aufgabe.pool_zurueck_am);

  const texte: Record<Anlass, string> = {
    verteilt: `${erneut ? "Erneut verteilt" : "Aufgabe verteilt"} an: ${bearbeiter} — ${jetzt()}`,
    pool: `Zurückgespielt in den Pool durch ${profil.fullName} — ${jetzt()}${
      grund?.trim() ? `\nBegründung: ${grund.trim()}` : ""
    }`,
    erledigt: `Erledigt durch ${profil.fullName} am ${jetzt()}`,
    geoeffnet: `Wieder geöffnet durch ${profil.fullName} — ${jetzt()}`,
  };

  try {
    await ruf({
      pfad: `/tasks/${aufgabe.asana_task_gid}/stories`,
      methode: "POST",
      daten: { text: texte[anlass] },
    });

    return NextResponse.json({ vermerkt: true, meldung: texte[anlass] });
  } catch (err) {
    return NextResponse.json(
      { vermerkt: false, meldung: `Asana hat den Vermerk abgelehnt: ${(err as Error).message}` },
      { status: 207 },
    );
  }
}
