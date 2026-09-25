/**
 * Der zweite Asana-Bereich: die persoenlichen Aufgaben.
 *
 * In Asana heisst das "Meine Aufgaben" - keine Projektliste, sondern
 * eine eigene Sache je Mensch, mit eigenen Abschnitten. Gelesen wird
 * sie ueber /tasks?assignee=me; in welchem Abschnitt eine Aufgabe
 * liegt, steht an ihr selbst als assignee_section.
 *
 * WICHTIG, und es ist die Entscheidung, an der alles haengt: eine
 * Aufgabe, die hier UND im Projekt vorkommt, ist EINE Aufgabe. Sie
 * bekommt keine zweite Zeile, sie steht auf beiden Brettern, und wenn
 * sie erledigt ist, ist sie es auf beiden. Zwei Zeilen waeren zwei
 * Wahrheiten, und eine davon waere immer falsch.
 *
 * Deshalb gibt es zwei Spalten an der Aufgabe: asana_section_gid fuer
 * das Projekt, asana_eigene_section_gid fuer die persoenliche Liste.
 * Beide duerfen leer sein, eine muss es sein, sonst steht die Karte
 * nirgends.
 */
import { asanaKonfiguriert, ruf, rufAlle, workspaceGid } from "@/lib/asana/client";
import { AUFGABEN_FELDER, type AsanaAufgabe, type AsanaSection } from "@/lib/asana/typen";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gibAbAnDenPool } from "@/lib/sync/asana";
import type { TaskStatus } from "@/lib/types";

/** Der Abschnitt, der eine Aufgabe abgibt. Von Hand in Asana angelegt. */
const POOL_ABSCHNITT = "pool";

/** Der Abschnitt, dessen Aufgaben im Tool "Rueckfragen offen" sind. */
const RUECKFRAGE_ABSCHNITT = "rückfragen offen";

export interface EigeneErgebnis {
  gelesen: number;
  uebernommen: number;
  neu: number;
  inDenPool: number;
  abschnitte: number;
  fehler: string[];
  meldung: string;
}

/**
 * Die Kennung der persoenlichen Aufgabenliste.
 *
 * Sie aendert sich nie, also wird sie einmal geholt und gemerkt - ein
 * Aufruf je Abgleich waere einer zu viel.
 */
export async function eigeneListeGid(): Promise<string | null> {
  const sb = supabaseAdmin();

  const { data: gemerkt } = await sb
    .from("asana_listen")
    .select("gid")
    .eq("schluessel", "eigene")
    .maybeSingle();

  if (gemerkt?.gid) return gemerkt.gid;

  try {
    const liste = await ruf<{ gid: string; name?: string }>({
      pfad: "/users/me/user_task_list",
      query: { workspace: workspaceGid(), opt_fields: "gid,name" },
    });

    if (!liste?.gid) return null;

    await sb
      .from("asana_listen")
      .upsert(
        { schluessel: "eigene", gid: liste.gid, name: liste.name ?? null, synced_at: new Date().toISOString() },
        { onConflict: "schluessel" },
      );

    return liste.gid;
  } catch {
    return null;
  }
}

/**
 * Die Abschnitte der persoenlichen Liste spiegeln.
 *
 * Zwei Wege, und der erste ist der wichtigere: ueber /sections kommen
 * AUCH LEERE Abschnitte. Genau das braucht man hier - der
 * Pool-Abschnitt ist frisch angelegt und leer, und ein Ausgang, den
 * das Board nicht kennt, ist kein Ausgang.
 *
 * Antwortet Asana darauf nicht, bleibt der zweite Weg: die Abschnitte
 * aus den Aufgaben selbst ablesen. Dann fehlt, was leer ist - besser
 * als gar kein Board.
 */
async function spiegleAbschnitte(
  listeGid: string,
  ausAufgaben: Map<string, string>,
): Promise<{ poolGid: string | null; anzahl: number }> {
  const sb = supabaseAdmin();
  let abschnitte: AsanaSection[] = [];

  try {
    abschnitte = await rufAlle<AsanaSection>(`/projects/${listeGid}/sections`, {
      opt_fields: "gid,name",
    });
  } catch {
    abschnitte = [];
  }

  // Was ueber die Aufgaben bekannt ist, ergaenzen - und zwar auch dann,
  // wenn der erste Weg funktioniert hat: ein Abschnitt, in dem eine
  // Aufgabe liegt, gehoert aufs Board, egal was die Liste sagt.
  for (const [gid, name] of ausAufgaben) {
    if (!abschnitte.some((a) => a.gid === gid)) abschnitte.push({ gid, name });
  }

  if (!abschnitte.length) return { poolGid: null, anzahl: 0 };

  const pool = abschnitte.find((a) => a.name.trim().toLowerCase() === POOL_ABSCHNITT);

  // Der Pool ganz nach links, wie im Projektbereich: er ist der
  // Ausgang, und man soll nicht durch die halbe Liste scrollen, um
  // etwas abzugeben. Umsortiert wird nur hier, nicht in Asana -
  // "Meine Aufgaben" ist seine Liste, da raeumen wir nicht auf.
  const sortiert = pool
    ? [pool, ...abschnitte.filter((a) => a.gid !== pool.gid)]
    : abschnitte;

  await sb.from("asana_sections").upsert(
    sortiert.map((a, i) => ({
      gid: a.gid,
      name: a.name,
      bereich: "eigene",
      sort_order: (i + 1) * 10,
      ist_pool: a.gid === pool?.gid,
      synced_at: new Date().toISOString(),
    })),
    { onConflict: "gid" },
  );

  return { poolGid: pool?.gid ?? null, anzahl: sortiert.length };
}

function statusAus(aufgabe: AsanaAufgabe, abschnittName: string): TaskStatus {
  if (aufgabe.completed) return "erledigt";
  if (abschnittName.trim().toLowerCase() === RUECKFRAGE_ABSCHNITT) return "in_bearbeitung";
  return "offen";
}

export async function synchronisiereEigene(): Promise<EigeneErgebnis> {
  const ergebnis: EigeneErgebnis = {
    gelesen: 0,
    uebernommen: 0,
    neu: 0,
    inDenPool: 0,
    abschnitte: 0,
    fehler: [],
    meldung: "",
  };

  if (!asanaKonfiguriert()) {
    ergebnis.meldung = "ASANA_TOKEN ist in dieser Umgebung nicht gesetzt.";
    return ergebnis;
  }

  const listeGid = await eigeneListeGid();
  const sb = supabaseAdmin();

  // Erledigtes der letzten zwei Wochen mitlesen. Mit "now" saehe der
  // Abgleich nie, dass etwas abgehakt wurde - derselbe Fehler, der im
  // Projektbereich einmal dazu gefuehrt hat, dass erledigte Karten
  // ewig im Pool standen.
  const seit = new Date(Date.now() - 14 * 864e5).toISOString();

  let aufgaben: AsanaAufgabe[] = [];
  try {
    aufgaben = await rufAlle<AsanaAufgabe>("/tasks", {
      assignee: "me",
      workspace: workspaceGid(),
      opt_fields: `${AUFGABEN_FELDER},assignee_section.gid,assignee_section.name`,
      completed_since: seit,
    });
  } catch (err) {
    ergebnis.fehler.push(`Abruf aus Asana fehlgeschlagen: ${(err as Error).message}`);
    ergebnis.meldung = ergebnis.fehler[0];
    return ergebnis;
  }

  ergebnis.gelesen = aufgaben.length;

  const ausAufgaben = new Map<string, string>();
  for (const a of aufgaben) {
    const abschnitt = a.assignee_section;
    if (abschnitt?.gid) ausAufgaben.set(abschnitt.gid, abschnitt.name ?? "(ohne Namen)");
  }

  const { poolGid, anzahl } = await spiegleAbschnitte(listeGid ?? "", ausAufgaben);
  ergebnis.abschnitte = anzahl;

  if (!anzahl) {
    ergebnis.meldung =
      "Keine Abschnitte gefunden. In Asana unter „Meine Aufgaben“ müssen Abschnitte angelegt sein.";
    return ergebnis;
  }

  const namen = new Map<string, string>();
  const { data: gespiegelt } = await sb
    .from("asana_sections")
    .select("gid, name")
    .eq("bereich", "eigene");
  for (const s of gespiegelt ?? []) namen.set(s.gid, s.name);

  // Was kennen wir schon? Ueber die Asana-Nummer, nicht ueber den
  // Titel - Titel aendern sich.
  const gids = aufgaben.map((a) => a.gid);
  const bekannt = new Map<string, { id: string; bereich: string; status: string }>();
  if (gids.length) {
    const { data } = await sb
      .from("tasks")
      .select("id, asana_task_gid, bereich, status")
      .in("asana_task_gid", gids);
    for (const t of data ?? []) {
      if (t.asana_task_gid) {
        bekannt.set(t.asana_task_gid, { id: t.id, bereich: t.bereich, status: t.status });
      }
    }
  }

  // creator_id darf nicht leer sein. Die persoenlichen Aufgaben
  // gehoeren dem, dessen Token gerade liest - wir nehmen den ersten
  // Superadmin, so wie es der Projektbereich auch tut.
  const { data: ersatz } = await sb
    .from("profiles")
    .select("id")
    .eq("role", "superadmin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!ersatz) {
    ergebnis.fehler.push("Kein Superadmin gefunden – ohne den fehlt der Aufgabe ein Ersteller.");
    ergebnis.meldung = ergebnis.fehler[0];
    return ergebnis;
  }

  // Der Zaehler fuer die Reihenfolge. Asana gibt "Meine Aufgaben" in
  // Brettreihenfolge heraus; Abstand 100, damit beim Verschieben im
  // Tool immer ein Wert dazwischenpasst.
  let rang = 0;

  for (const aufgabe of aufgaben) {
    rang += 100;
    const abschnitt = aufgabe.assignee_section;
    const abschnittGid = abschnitt?.gid ?? null;
    const abschnittName = abschnittGid ? (namen.get(abschnittGid) ?? abschnitt?.name ?? "") : "";
    const vorhanden = bekannt.get(aufgabe.gid);

    // Im Pool-Abschnitt heisst: abgegeben. Derselbe Weg wie im
    // Projektbereich - und dort steht auch, was dabei alles mitgeht.
    if (poolGid && abschnittGid === poolGid && vorhanden && vorhanden.bereich === "asana") {
      try {
        await gibAbAnDenPool(vorhanden.id, aufgabe.gid, aufgabe.name);
        ergebnis.inDenPool++;
      } catch (err) {
        ergebnis.fehler.push(`Abgabe von ${aufgabe.name}: ${(err as Error).message}`);
      }
      continue;
    }

    const zeile: Record<string, unknown> = {
      title: aufgabe.name || "(ohne Titel)",
      description: aufgabe.notes || null,
      status: statusAus(aufgabe, abschnittName),
      asana_task_gid: aufgabe.gid,
      asana_eigene_section_gid: abschnittGid,
      asana_assignee_gid: aufgabe.assignee?.gid ?? null,
      asana_eigene_rang: rang,
      due_date: aufgabe.due_on ?? null,
      updated_at: new Date().toISOString(),
    };

    if (aufgabe.completed) {
      zeile.completed_at = aufgabe.completed_at ?? new Date().toISOString();
    } else {
      zeile.completed_at = null;
      zeile.completed_by = null;
    }

    try {
      if (vorhanden) {
        // Eine Aufgabe, die laengst im Pool oder bei jemandem liegt,
        // wird hier NICHT zurueckgeholt. Nur der Abschnitt und der
        // Status werden nachgezogen - alles andere fuehrt inzwischen
        // das Tool.
        if (vorhanden.bereich !== "asana") {
          await sb
            .from("tasks")
            .update({
              asana_eigene_section_gid: abschnittGid,
              asana_eigene_rang: rang,
              ...(aufgabe.completed ? { status: "erledigt", completed_at: zeile.completed_at } : {}),
            })
            .eq("id", vorhanden.id);
        } else {
          await sb.from("tasks").update(zeile).eq("id", vorhanden.id);
        }
        ergebnis.uebernommen++;
      } else {
        // Neu, und nur hier: Aufgaben, die auch im Projekt liegen, hat
        // der Projektabgleich schon angelegt.
        await sb.from("tasks").insert({
          ...zeile,
          bereich: "asana",
          creator_id: ersatz.id,
          visible_from: new Date().toISOString().slice(0, 10),
          source: "manuell",
        });
        ergebnis.neu++;
        ergebnis.uebernommen++;
      }
    } catch (err) {
      ergebnis.fehler.push(`${aufgabe.name}: ${(err as Error).message}`);
    }
  }

  const teile = [
    `${ergebnis.gelesen} gelesen`,
    `${ergebnis.uebernommen} uebernommen (${ergebnis.neu} neu)`,
    `${ergebnis.abschnitte} Abschnitte`,
    `${ergebnis.inDenPool} in den Pool`,
  ];
  if (ergebnis.fehler.length) teile.push(`${ergebnis.fehler.length} Fehler`);
  ergebnis.meldung = teile.join(", ");

  return ergebnis;
}
