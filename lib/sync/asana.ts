/**
 * Den Asana-Bereich der Geschaeftsfuehrung spiegeln.
 *
 * Richtung: Asana fuehrt. Titel, Text, Zustaendigkeit, Faelligkeit und
 * die Spalte kommen von dort; das Tool bildet sie ab und legt sie in
 * onOffice an. Wer hier etwas aendert, aendert es in Asana - nicht
 * umgekehrt. Eine Regel, die man sich merken kann, ist mehr wert als
 * ein Dutzend Sonderfaelle.
 *
 * Die einzige Ausnahme ist die Spalte "Pool". Was dort landet, verlaesst
 * den Bereich der Geschaeftsfuehrung: es wandert in den Aufgabenpool des
 * Tools, verschwindet aus dem Asana-Board und meldet sich bei
 * Geschaeftsfuehrung und Qualitaetsmanagement. Das ist der eine Weg
 * zurueck, und er ist bewusst eine Einbahnstrasse: eine Aufgabe, die
 * abgegeben wurde, soll nicht beim naechsten Lauf wieder auftauchen.
 *
 * Erledigtes aus der Vergangenheit wird nicht geholt - dasselbe
 * Prinzip wie bei onOffice. Das Projekt hat dreihundert Aufgaben, von
 * denen die meisten seit Monaten fertig sind.
 */

import { asanaKonfiguriert, projektGid, ruf, rufAlle } from "@/lib/asana/client";
import { AUFGABEN_FELDER, type AsanaAufgabe, type AsanaSection, type AsanaStory } from "@/lib/asana/typen";
import { createTask } from "@/lib/onoffice/tasks";
import { pruefeSchreibsperre } from "@/lib/onoffice/schreibsperre";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TaskStatus } from "@/lib/types";

/** Wie die Spalte heisst, die eine Aufgabe abgibt. */
const POOL_SPALTE = "Pool";

/** Die Spalte, deren Aufgaben im Tool als "Rueckfragen offen" gelten. */
const RUECKFRAGE_SPALTE = "rückfragen offen";

export interface AsanaErgebnis {
  gelesen: number;
  uebernommen: number;
  neu: number;
  aktualisiert: number;
  inDenPool: number;
  kommentare: number;
  inOnoffice: number;
  fehler: string[];
  meldung: string;
}

function leer(): AsanaErgebnis {
  return {
    gelesen: 0,
    uebernommen: 0,
    neu: 0,
    aktualisiert: 0,
    inDenPool: 0,
    kommentare: 0,
    inOnoffice: 0,
    fehler: [],
    meldung: "",
  };
}

/** Die Spalte einer Aufgabe IN UNSEREM Projekt - sie kann in mehreren liegen. */
function spalteVon(aufgabe: AsanaAufgabe): AsanaSection | undefined {
  const projekt = projektGid();
  return aufgabe.memberships?.find((m) => m.project?.gid === projekt)?.section;
}

function statusAus(aufgabe: AsanaAufgabe, spaltenName: string): TaskStatus {
  if (aufgabe.completed) return "erledigt";
  if (spaltenName.trim().toLowerCase() === RUECKFRAGE_SPALTE) return "in_bearbeitung";
  return "offen";
}

/**
 * Die Spalten spiegeln und dafuer sorgen, dass es die Pool-Spalte gibt.
 *
 * Fehlt sie, legen wir sie an. Das ist ein Schreibvorgang in fremde
 * Daten, aber ohne sie hat der ganze Bereich keinen Ausgang - und eine
 * leere Spalte richtet keinen Schaden an.
 */
async function spiegleSpalten(): Promise<{ poolGid: string | null; namen: Map<string, string> }> {
  const sb = supabaseAdmin();
  const spalten = await rufAlle<AsanaSection>(`/projects/${projektGid()}/sections`, {
    opt_fields: "gid,name",
  });

  let pool = spalten.find((s) => s.name.trim().toLowerCase() === POOL_SPALTE.toLowerCase());

  if (!pool) {
    pool = await ruf<AsanaSection>({
      pfad: `/projects/${projektGid()}/sections`,
      methode: "POST",
      daten: { name: POOL_SPALTE },
    });
    spalten.push(pool);
  }

  const zeilen = spalten.map((s, i) => ({
    gid: s.gid,
    name: s.name,
    sort_order: (i + 1) * 10,
    ist_pool: s.gid === pool!.gid,
    synced_at: new Date().toISOString(),
  }));

  await sb.from("asana_sections").upsert(zeilen, { onConflict: "gid" });

  return {
    poolGid: pool?.gid ?? null,
    namen: new Map(spalten.map((s) => [s.gid, s.name])),
  };
}

/** Asana-Nutzer auf Profile abbilden - ueber die Mailadresse. */
async function nutzerVerzeichnis(): Promise<Map<string, string>> {
  const sb = supabaseAdmin();
  const { data } = await sb.from("profiles").select("id, email");
  const karte = new Map<string, string>();
  for (const p of data ?? []) {
    if (p.email) karte.set(p.email.trim().toLowerCase(), p.id);
  }
  return karte;
}

/**
 * Kommentare einer Aufgabe holen und als Notizen ablegen.
 *
 * Nur echte Kommentare, nicht das Protokoll ("hat den Status
 * geaendert"). Wer die Notizen einer Aufgabe liest, will das Gespraech
 * sehen und nicht die Maschine.
 */
async function holeKommentare(
  asanaGid: string,
  taskId: string,
  verzeichnis: Map<string, string>,
  ersatzAutor: string,
): Promise<number> {
  const sb = supabaseAdmin();

  const stories = await rufAlle<AsanaStory>(`/tasks/${asanaGid}/stories`, {
    opt_fields: "gid,type,resource_subtype,text,created_at,created_by.email,created_by.name",
  });

  const kommentare = stories.filter(
    (s) => s.type === "comment" || s.resource_subtype === "comment_added",
  );
  if (!kommentare.length) return 0;

  const { data: bekannt } = await sb
    .from("task_notes")
    .select("asana_comment_gid")
    .eq("task_id", taskId)
    .not("asana_comment_gid", "is", null);

  const schon = new Set((bekannt ?? []).map((n) => n.asana_comment_gid));
  const neue = kommentare
    .filter((k) => !schon.has(k.gid))
    .map((k) => ({
      task_id: taskId,
      // Steht der Schreiber nicht im Tool, zeichnet der Ersteller -
      // author_id darf nicht leer sein, und ein erfundener Nutzer
      // waere schlimmer als ein bekannter.
      author_id:
        verzeichnis.get((k.created_by?.email ?? "").trim().toLowerCase()) ?? ersatzAutor,
      body:
        (k.text ?? "").trim() +
        (verzeichnis.has((k.created_by?.email ?? "").trim().toLowerCase())
          ? ""
          : `\n\n— aus Asana, geschrieben von ${k.created_by?.name ?? "unbekannt"}`),
      created_at: k.created_at,
      asana_comment_gid: k.gid,
    }))
    .filter((n) => n.body.trim().length > 0);

  if (!neue.length) return 0;

  const { error } = await sb.from("task_notes").insert(neue);
  if (error) throw new Error(`Kommentare: ${error.message}`);

  return neue.length;
}

/**
 * Eine Aufgabe, die in der Pool-Spalte liegt, abgeben.
 *
 * Drei Dinge auf einmal, und keines darf fehlen: sie wechselt den
 * Bereich, sie verlaesst das Asana-Projekt, und die Verantwortlichen
 * erfahren davon. Bliebe sie in Asana stehen, holte der naechste Lauf
 * sie zurueck.
 */
export async function gibAbAnDenPool(
  taskId: string,
  asanaGid: string,
  titel: string,
  durch?: string,
): Promise<void> {
  const sb = supabaseAdmin();

  await sb
    .from("tasks")
    .update({
      bereich: "task",
      is_pool: true,
      assignee_id: null,
      asana_section_gid: null,
      pool_grund: "Aus der Geschäftsführung in den Pool gegeben (Asana).",
      pool_zurueck_am: new Date().toISOString(),
      pool_zurueck_von: durch ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  // Aus dem Projekt nehmen, nicht loeschen: die Aufgabe hat eine
  // Geschichte, und die gehoert nicht in den Papierkorb.
  await ruf({
    pfad: `/tasks/${asanaGid}/removeProject`,
    methode: "POST",
    daten: { project: projektGid() },
  });

  const { data: empfaenger } = await sb
    .from("profiles")
    .select("id")
    .in("role", ["superadmin", "gf", "qm"])
    .eq("is_active", true);

  const zeilen = (empfaenger ?? [])
    .filter((p) => p.id !== durch)
    .map((p) => ({
    user_id: p.id,
    task_id: taskId,
    kind: "pool_aus_gf",
    titel: `Aus der Geschäftsführung in den Pool: ${titel}`,
    text: "Die Aufgabe liegt jetzt im Aufgabenpool und kann übernommen werden.",
  }));

  if (zeilen.length) await sb.from("notifications").insert(zeilen);
}

export async function synchronisiereAsana(): Promise<AsanaErgebnis> {
  const ergebnis = leer();
  const sb = supabaseAdmin();

  if (!asanaKonfiguriert()) {
    ergebnis.meldung = "ASANA_TOKEN ist in dieser Umgebung nicht gesetzt.";
    return ergebnis;
  }

  const { poolGid, namen } = await spiegleSpalten();
  const verzeichnis = await nutzerVerzeichnis();

  // Wer zeichnet, wenn niemand passt? Der erste Superadmin - creator_id
  // darf nicht leer sein.
  const { data: ersatz } = await sb
    .from("profiles")
    .select("id")
    .in("role", ["superadmin", "gf"])
    .order("role")
    .limit(1)
    .maybeSingle();

  const ersatzAutor = ersatz?.id;
  if (!ersatzAutor) {
    ergebnis.fehler.push("Kein Nutzer mit Rolle Superadmin oder GF - ohne den geht es nicht.");
    ergebnis.meldung = ergebnis.fehler[0];
    return ergebnis;
  }

  // completed_since=now liefert die offenen Aufgaben plus das, was
  // gerade fertig wurde. Alles andere ist Vergangenheit.
  let aufgaben: AsanaAufgabe[] = [];
  try {
    aufgaben = await rufAlle<AsanaAufgabe>(`/projects/${projektGid()}/tasks`, {
      opt_fields: AUFGABEN_FELDER,
      completed_since: "now",
    });
  } catch (err) {
    ergebnis.fehler.push(`Abruf aus Asana fehlgeschlagen: ${(err as Error).message}`);
    ergebnis.meldung = ergebnis.fehler[0];
    return ergebnis;
  }

  ergebnis.gelesen = aufgaben.length;

  const gids = aufgaben.map((a) => a.gid);
  const bekannt = new Map<string, { id: string; asana_modified_at: string | null }>();
  if (gids.length) {
    const { data } = await sb
      .from("tasks")
      .select("id, asana_task_gid, asana_modified_at")
      .in("asana_task_gid", gids);
    for (const t of data ?? []) {
      if (t.asana_task_gid) {
        bekannt.set(t.asana_task_gid, { id: t.id, asana_modified_at: t.asana_modified_at });
      }
    }
  }

  // Zwei Bedingungen, und beide muessen ja sagen: der allgemeine
  // Schreibweg nach onOffice und der eigene Schalter fuer diesen
  // Bereich. Einundvierzig Datensaetze auf einmal legt man nicht
  // nebenbei an.
  const { data: einst } = await sb
    .from("app_settings")
    .select("sync_asana_onoffice")
    .maybeSingle();

  const darfOnoffice =
    (einst as { sync_asana_onoffice?: boolean } | null)?.sync_asana_onoffice === true &&
    (await pruefeSchreibsperre("anlegen")).erlaubt;

  for (const aufgabe of aufgaben) {
    const spalte = spalteVon(aufgabe);
    const spaltenName = spalte ? (namen.get(spalte.gid) ?? spalte.name ?? "") : "";
    const vorhanden = bekannt.get(aufgabe.gid);
    const bearbeiterId = verzeichnis.get((aufgabe.assignee?.email ?? "").trim().toLowerCase());

    // Was drueben fertig ist und hier noch nie war, bleibt drueben.
    if (!vorhanden && aufgabe.completed) continue;

    const zeile: Record<string, unknown> = {
      title: aufgabe.name || "(ohne Titel)",
      description: aufgabe.notes?.trim() || null,
      status: statusAus(aufgabe, spaltenName),
      assignee_id: bearbeiterId ?? null,
      creator_id: vorhanden ? undefined : ersatzAutor,
      bereich: "asana",
      asana_task_gid: aufgabe.gid,
      asana_section_gid: spalte?.gid ?? null,
      asana_modified_at: aufgabe.modified_at ?? null,
      due_date: aufgabe.due_on ?? null,
      visible_from: aufgabe.start_on ?? new Date().toISOString().slice(0, 10),
      source: "manuell",
      is_pool: false,
      updated_at: new Date().toISOString(),
    };
    if (aufgabe.completed) {
      zeile.completed_at = aufgabe.completed_at ?? new Date().toISOString();
    } else {
      zeile.completed_at = null;
      zeile.completed_by = null;
    }
    for (const schluessel of Object.keys(zeile)) {
      if (zeile[schluessel] === undefined) delete zeile[schluessel];
    }

    let taskId = vorhanden?.id;

    try {
      if (vorhanden) {
        const { error } = await sb.from("tasks").update(zeile).eq("id", vorhanden.id);
        if (error) throw new Error(error.message);
        ergebnis.aktualisiert++;
      } else {
        const { data, error } = await sb.from("tasks").insert(zeile).select("id").single();
        if (error) throw new Error(error.message);
        taskId = data?.id;
        ergebnis.neu++;
      }
      ergebnis.uebernommen++;
    } catch (err) {
      ergebnis.fehler.push(`${aufgabe.name}: ${(err as Error).message}`);
      continue;
    }

    if (!taskId) continue;

    // Nur nachsehen, wenn sich drueben etwas getan hat - Kommentare
    // kosten je Aufgabe einen Aufruf.
    const veraendert =
      !vorhanden || (aufgabe.modified_at ?? "") !== (vorhanden.asana_modified_at ?? "");

    if (veraendert) {
      try {
        ergebnis.kommentare += await holeKommentare(
          aufgabe.gid,
          taskId,
          verzeichnis,
          ersatzAutor,
        );
      } catch (err) {
        ergebnis.fehler.push(`Kommentare zu ${aufgabe.name}: ${(err as Error).message}`);
      }
    }

    // In onOffice anlegen, was dort noch nicht steht.
    if (darfOnoffice) {
      const { data: stand } = await sb
        .from("tasks")
        .select("onoffice_task_id")
        .eq("id", taskId)
        .maybeSingle();

      if (!stand?.onoffice_task_id) {
        try {
          const { data: wer } = bearbeiterId
            ? await sb
                .from("profiles")
                .select("onoffice_display_name")
                .eq("id", bearbeiterId)
                .maybeSingle()
            : { data: null };

          const nummer = await createTask({
            subject: aufgabe.name || "(ohne Titel)",
            description: aufgabe.notes?.trim() || undefined,
            status: statusAus(aufgabe, spaltenName),
            processor: wer?.onoffice_display_name?.trim() || undefined,
            deadline: aufgabe.due_on ?? undefined,
          });

          await sb
            .from("tasks")
            .update({ onoffice_task_id: nummer, onoffice_synced_at: new Date().toISOString() })
            .eq("id", taskId);

          ergebnis.inOnoffice++;
        } catch (err) {
          ergebnis.fehler.push(`onOffice zu ${aufgabe.name}: ${(err as Error).message}`);
        }
      }
    }

    // Zum Schluss der eine Weg zurueck.
    if (poolGid && spalte?.gid === poolGid) {
      try {
        await gibAbAnDenPool(taskId, aufgabe.gid, aufgabe.name);
        ergebnis.inDenPool++;
      } catch (err) {
        ergebnis.fehler.push(`Abgabe von ${aufgabe.name}: ${(err as Error).message}`);
      }
    }
  }

  const teile = [
    `${ergebnis.gelesen} gelesen`,
    `${ergebnis.uebernommen} uebernommen (${ergebnis.neu} neu, ${ergebnis.aktualisiert} aktualisiert)`,
    `${ergebnis.kommentare} Kommentare`,
    `${ergebnis.inOnoffice} in onOffice angelegt`,
    `${ergebnis.inDenPool} in den Pool`,
  ];
  if (ergebnis.fehler.length) teile.push(`${ergebnis.fehler.length} Fehler`);
  ergebnis.meldung = teile.join(", ");

  await sb.from("onoffice_sync_log").insert({
    direction: "pull",
    resource: "asana",
    ok: ergebnis.fehler.length === 0,
    message: ergebnis.meldung,
    payload: { fehler: ergebnis.fehler.slice(0, 20) },
  });

  await sb.from("onoffice_sync_cursor").upsert({
    resource: "asana",
    last_run_at: new Date().toISOString(),
    initial_done: true,
  });

  return ergebnis;
}
