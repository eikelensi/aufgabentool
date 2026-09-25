/**
 * Aufgaben aus onOffice holen.
 *
 * Regel, die alles bestimmt: es werden nur Aufgaben uebernommen, bei denen
 * der Bearbeiter ODER die Verantwortung auf einen Nutzer des Tools passt.
 * Alles andere wird gezaehlt und liegen gelassen - das CRM enthaelt tausende
 * Aufgaben, die hier nichts zu suchen haben.
 *
 * Der Abgleich laeuft ueber profiles.onoffice_display_name, also den String,
 * wie er in den onOffice-Feldern steht ("Lensinger, Eike (EL)"). Nicht ueber
 * die Mailadresse: die Benutzerliste der Schnittstelle gibt in diesem
 * Mandanten nur Mailadressen her und keine Namen, und in den Aufgaben steht
 * umgekehrt nur der Name.
 *
 * Richtung: onOffice fuehrt bei Titel, Beschreibung, Status, Prioritaet und
 * Fristen. Rein lokale Felder - Kategorie, Pflichtnotiz, Kollege,
 * Anhaenge - werden nie ueberschrieben.
 */

import { readTasks, type OnofficeTask } from "@/lib/onoffice/tasks";
import { istAbgeschlossen } from "@/lib/onoffice/mapping";
import { ohneNotizen } from "@/lib/onoffice/notizen";
import { erfasseAnhangIds } from "@/lib/sync/anhaenge";
import {
  holeVerknuepfungen,
  legeFehlendeAn,
  zieheVerknuepfungenNach,
} from "@/lib/sync/onoffice-neu";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface NameMitAnzahl {
  name: string;
  anzahl: number;
}

export interface SyncErgebnis {
  gelesen: number;
  uebernommen: number;
  neu: number;
  aktualisiert: number;
  uebersprungen: number;
  /**
   * Abgeschlossene Aufgaben, die wir noch nicht kennen - nicht geholt.
   * Siehe istAbgeschlossen(): der Mandant hat knapp 600 Aufgaben allein
   * fuer einen Nutzer, fast alle erledigt. Die gehoeren nicht ins Tool.
   */
  altlasten: number;
  unbekannteNamen: string[];
  /**
   * Jeder Name, der in den geholten Aufgaben als Bearbeiter oder
   * Verantwortung stand, mit der Zahl seiner Aufgaben - auch die bereits
   * zugeordneten. Das ist die Liste, aus der die Zuordnung gewaehlt
   * wird, statt den Namen abzutippen.
   */
  gefundeneNamen: NameMitAnzahl[];
  /** Es war noch kein Nutzer zugeordnet: gelesen, aber nichts uebernommen. */
  erkundung: boolean;
  /** Neu entdeckte Dateien an den geholten Aufgaben (Inhalte folgen). */
  anhaengeErfasst: number;
  /** Objekt- oder Kundenverknuepfungen, die aus onOffice nachgetragen wurden. */
  verknuepfungenGeholt: number;
  /** Aus dem Feld "tags" zugeordnete Auftraggeber. */
  tagsZugeordnet: number;
  /**
   * Tags, zu denen kein Kollege gefunden wurde - oder zu viele. Die
   * Liste ist die Arbeitsanweisung: in der Verwaltung beim richtigen
   * Kollegen als onOffice-Tag eintragen.
   */
  unbekannteTags: string[];
  fehler: string[];
  hinweise: string[];
  seit: string;
  bisModified: string | null;
}

/** onOffice lehnt listoffset fuer Aufgaben ab, Blaettern ist also nicht
 *  moeglich. Wird die Grenze erreicht, muss das Fenster kleiner werden. */
const GRENZE = 500;

/** Namen vergleichbar machen: Grossschreibung und Mehrfach-Leerzeichen weg. */
function normalisiere(name: string | null | undefined): string {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

interface NutzerVerzeichnis {
  /** normalisierter onOffice-Anzeigename -> profile.id */
  nachName: Map<string, string>;
  anzahl: number;
}

async function ladeVerzeichnis(): Promise<NutzerVerzeichnis> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("profiles")
    .select("id, onoffice_display_name")
    .not("onoffice_display_name", "is", null);

  if (error) throw new Error(`Nutzerliste nicht lesbar: ${error.message}`);

  const nachName = new Map<string, string>();
  for (const p of data ?? []) {
    const key = normalisiere(p.onoffice_display_name);
    if (key) nachName.set(key, p.id);
  }
  return { nachName, anzahl: nachName.size };
}

/**
 * Welches Tag meint welchen Kollegen.
 *
 * In onOffice steht am Feld "tags" ein kurzer Name - "Lensinger" -,
 * im Tool heisst derselbe Mensch "Lensinger, Eike (BaufiLensinger)".
 * Zusammengefuehrt wird ueber broker_contacts.onoffice_tag, ein Feld,
 * das in der Verwaltung gepflegt wird. Ersatzweise das Kuerzel und
 * der Nachname aus dem Anzeigenamen - das trifft die meisten Faelle,
 * ohne dass jemand etwas eintragen muss.
 *
 * MEHRDEUTIGE Tags werden ausdruecklich NICHT zugeordnet. "Peissig"
 * gibt es hier zweimal, Christian und Lisa. Wer raet, schickt die
 * Erledigt-Mail an den Falschen - lieber gar keine Zuordnung und ein
 * Hinweis im Protokoll.
 */
interface TagVerzeichnis {
  /** normalisiertes Tag -> broker_contacts.id, oder null bei Mehrdeutigkeit. */
  nachTag: Map<string, string | null>;
}

async function ladeTagVerzeichnis(): Promise<TagVerzeichnis> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("broker_contacts")
    .select("id, display_name, short_code, onoffice_tag")
    .eq("is_active", true);

  const nachTag = new Map<string, string | null>();

  // Reihenfolge ist Rangfolge: was ausdruecklich eingetragen wurde,
  // schlaegt das Geratene. Deshalb drei Durchgaenge statt einem.
  const eintragen = (wert: string | null | undefined, id: string, festgelegt: boolean) => {
    const key = normalisiere(wert);
    if (!key) return;
    const vorhanden = nachTag.get(key);
    if (vorhanden === undefined) {
      nachTag.set(key, id);
      return;
    }
    // Schon belegt: von jemand anderem heisst mehrdeutig. Es sei denn,
    // ein ausdruecklich gepflegtes Tag kommt ueber einen geratenen
    // Eintrag - dann gewinnt das gepflegte.
    if (vorhanden !== id) nachTag.set(key, festgelegt && !vorhanden ? id : null);
  };

  for (const k of data ?? []) eintragen(k.onoffice_tag, k.id, true);
  for (const k of data ?? []) eintragen(k.short_code, k.id, false);
  for (const k of data ?? []) {
    const nachname = String(k.display_name ?? "").split(",")[0];
    eintragen(nachname, k.id, false);
  }

  return { nachTag };
}

/**
 * Seit wann holen? Der Merker in onoffice_sync_cursor, minus einer
 * Ueberlappung, damit nichts durchfaellt, das waehrend des letzten Laufs
 * geaendert wurde.
 */
async function bestimmeStart(ueberlappungMinuten: number): Promise<string> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("onoffice_sync_cursor")
    .select("last_modified_seen, initial_done")
    .eq("resource", "task")
    .maybeSingle();

  if (!data?.initial_done || !data.last_modified_seen) {
    // Erster Lauf: 180 Tage zurueck. Aelteres ist fuer das Tagesgeschaeft
    // ohne Belang und blaeht die Tabelle nur auf.
    return new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
  }

  const seit = new Date(data.last_modified_seen);
  seit.setMinutes(seit.getMinutes() - ueberlappungMinuten);
  return seit.toISOString().slice(0, 10);
}

function zuZeitstempel(datum: string | null): string | null {
  if (!datum) return null;
  const d = new Date(datum);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function synchronisiereAufgaben(
  optionen: { seit?: string; ueberlappungMinuten?: number } = {},
): Promise<SyncErgebnis> {
  const sb = supabaseAdmin();

  const { data: einstellungen } = await sb
    .from("app_settings")
    .select("sync_overlap_minutes")
    .maybeSingle();

  const ueberlappung = optionen.ueberlappungMinuten ?? einstellungen?.sync_overlap_minutes ?? 5;
  const seit = optionen.seit ?? (await bestimmeStart(ueberlappung));

  const verzeichnis = await ladeVerzeichnis();
  const tags = await ladeTagVerzeichnis();

  const ergebnis: SyncErgebnis = {
    gelesen: 0,
    uebernommen: 0,
    neu: 0,
    aktualisiert: 0,
    uebersprungen: 0,
    altlasten: 0,
    unbekannteNamen: [],
    gefundeneNamen: [],
    // Ohne eine einzige Zuordnung wird gelesen, aber nichts uebernommen.
    // Frueher brach der Lauf hier ab - und genau dann brauchte man ihn:
    // die Namen, die man zuordnen soll, stehen ja in den Aufgaben. Wer
    // sie nicht sieht, tippt sie ab, vertippt sich, und der Abgleich
    // meldet danach stumm null Aufgaben.
    erkundung: verzeichnis.anzahl === 0,
    anhaengeErfasst: 0,
    verknuepfungenGeholt: 0,
    tagsZugeordnet: 0,
    unbekannteTags: [],
    fehler: [],
    hinweise: [],
    seit,
    bisModified: null,
  };

  if (ergebnis.erkundung) {
    ergebnis.hinweise.push(
      "Noch ist kein Nutzer einem onOffice-Namen zugeordnet. Dieser Lauf hat " +
        "deshalb nur nachgesehen, welche Namen dort vorkommen, und nichts " +
        "uebernommen. Ordne unten zu und hol dann noch einmal.",
    );
  }

  let crmAufgaben: OnofficeTask[] = [];
  try {
    const res = await readTasks({ modifiedSince: seit, listLimit: GRENZE });
    crmAufgaben = res.tasks;

    // Ein Feld, das der Mandant ablehnt, sah bisher aus wie ein Feld,
    // das leer ist. Genau daran haben wir bei relatedEstateId Monate
    // verloren - also sagen wir es jetzt.
    if (res.weggelassen.length) {
      ergebnis.hinweise.push(
        `Der Lesecall hat diese Felder abgelehnt und weggelassen: ${res.weggelassen.join(", ")}. ` +
          (res.weggelassen.includes("tags")
            ? "Damit kommt der Auftraggeber (Feld „tags“) nicht mit – das muss onOffice für die " +
              "Schnittstelle freischalten."
            : ""),
      );
    }
  } catch (err) {
    ergebnis.fehler.push(`Abruf aus onOffice fehlgeschlagen: ${(err as Error).message}`);
    return ergebnis;
  }

  ergebnis.gelesen = crmAufgaben.length;

  if (crmAufgaben.length >= GRENZE) {
    ergebnis.hinweise.push(
      `Es kamen ${GRENZE} Aufgaben zurueck - das ist die Obergrenze eines Abrufs. ` +
        "Blaettern laesst diese Schnittstelle nicht zu (listoffset wird abgelehnt), " +
        "es koennen also aeltere Aenderungen fehlen. Bitte den Lauf mit einem " +
        "kuerzeren Zeitraum wiederholen, dann rueckt der Merker schrittweise vor.",
    );
  }

  // Welche onoffice_task_id kennen wir schon? Bestimmt neu vs. aktualisiert
  // und verhindert, dass ein Upsert lokale Felder ueberschreibt.
  const ids = crmAufgaben.map((t) => t.id).filter(Boolean);
  const bekannt = new Map<
    string,
    { id: string; in_progress_note: string | null; broker_contact_id: string | null }
  >();
  if (ids.length) {
    const { data: vorhanden } = await sb
      .from("tasks")
      .select("id, onoffice_task_id, in_progress_note, broker_contact_id")
      .in("onoffice_task_id", ids);
    for (const t of vorhanden ?? []) {
      if (t.onoffice_task_id) {
        bekannt.set(t.onoffice_task_id, {
          id: t.id,
          in_progress_note: t.in_progress_note,
          broker_contact_id: t.broker_contact_id,
        });
      }
    }
  }

  const unbekannt = new Set<string>();
  const tagsOhneZuordnung = new Set<string>();
  /** Jeder vorkommende Name mit der Zahl seiner Aufgaben. */
  const zaehler = new Map<string, number>();
  const zaehle = (name: string | null | undefined) => {
    const sauber = String(name ?? "").trim().replace(/\s+/g, " ");
    if (sauber) zaehler.set(sauber, (zaehler.get(sauber) ?? 0) + 1);
  };
  let maxModified: string | null = null;
  /** Welche Aufgaben dieser Lauf angefasst hat - fuer die Dateien. */
  const angefasst: { onofficeTaskId: string; taskId: string }[] = [];

  for (const aufgabe of crmAufgaben) {
    const modified = zuZeitstempel(aufgabe.modifiedAt);
    if (modified && (!maxModified || modified > maxModified)) maxModified = modified;

    zaehle(aufgabe.processor);
    if (normalisiere(aufgabe.responsibility) !== normalisiere(aufgabe.processor)) {
      zaehle(aufgabe.responsibility);
    }

    const bearbeiterId = verzeichnis.nachName.get(normalisiere(aufgabe.processor));
    const verantwortungId = verzeichnis.nachName.get(normalisiere(aufgabe.responsibility));

    if (!bearbeiterId && !verantwortungId) {
      ergebnis.uebersprungen++;
      if (aufgabe.processor) unbekannt.add(aufgabe.processor);
      if (aufgabe.responsibility) unbekannt.add(aufgabe.responsibility);
      continue;
    }

    // creator_id darf nicht leer sein. Die Verantwortung ist der richtige
    // Ersteller; fehlt sie, tritt der Bearbeiter ein.
    const creatorId = verantwortungId ?? bearbeiterId!;
    const vorhandene = bekannt.get(aufgabe.id);

    // Keine Altlasten. Was abgeschlossen ist und hier noch nie war,
    // bleibt drueben. Was wir schon kennen, wird weiter aktualisiert -
    // eine Aufgabe, die im Tool erledigt wurde, soll nicht beim
    // naechsten Lauf wieder verschwinden.
    if (!vorhandene && istAbgeschlossen(aufgabe.rawStatus)) {
      ergebnis.altlasten++;
      continue;
    }

    // Die Datenbank verlangt bei "Rückfragen offen" eine Notiz (in onOffice
    // heisst dieser Status "In Bearbeitung"). Aus onOffice
    // kommt keine - das Feld Kommentar existiert in diesem Mandanten nicht.
    // Also ein ehrlicher Platzhalter, aber nur wenn noch keine Notiz da ist.
    let notiz = vorhandene?.in_progress_note ?? null;
    if (aufgabe.status === "in_bearbeitung" && !notiz?.trim()) {
      notiz = "Status aus onOffice übernommen – dort ist keine Notiz hinterlegt.";
    }

    const zeile: Record<string, unknown> = {
      title: aufgabe.subject || "(ohne Betreff)",
      // Der Notizblock am Ende der Beschreibung gehoert dem Tool und
      // steht hier schon in task_notes - er darf nicht als
      // Beschreibung zurueckkommen, sonst steht er bald doppelt.
      description: ohneNotizen(aufgabe.description) || null,
      status: aufgabe.status,
      priority: aufgabe.priority,
      assignee_id: bearbeiterId ?? null,
      creator_id: creatorId,
      // Im Pool landet nur, was in onOffice UEBERHAUPT KEINEN Bearbeiter
      // hat. Steht dort jemand drin, den das Tool nicht kennt, ist die
      // Aufgabe nicht herrenlos - sie gehoert nur jemandem ausserhalb.
      // Sie in den Pool zu legen wuerde einen Kollegen einladen, sich
      // etwas zu ziehen, das laengst vergeben ist.
      is_pool: !aufgabe.processor?.trim(),
      is_private: aufgabe.isPrivate,
      visible_from: aufgabe.startDate ?? new Date().toISOString().slice(0, 10),
      due_date: aufgabe.deadline,
      source: "onoffice",
      onoffice_task_id: aufgabe.id,
      onoffice_synced_at: new Date().toISOString(),
      onoffice_modified_at: modified,
      onoffice_status_raw: aufgabe.rawStatus || null,
      onoffice_prio_raw: aufgabe.rawPriority || null,
      onoffice_art_raw: aufgabe.rawArt || null,
      onoffice_assignee: aufgabe.processor || null,
      onoffice_responsible: aufgabe.responsibility || null,
      // KEIN onoffice_estate_id / onoffice_address_id an dieser Stelle.
      // Die Felder kamen aus dem Aufgabendatensatz - und der gibt sie
      // nicht her: relatedEstateId ist in onOffice ein Eingabewert
      // beim Anlegen, kein Feld. Der Leseaufruf fragte es gar nicht
      // mit ab, also stand hier bei JEDEM Lauf null - und hat eine
      // von Hand eingetragene Verknuepfung wieder geloescht. Gefuellt
      // wird weiter unten aus den Relationen (holeVerknuepfungen).
      in_progress_note: notiz,
      updated_at: new Date().toISOString(),
    };

    // Das Feld "tags" sagt, FUER WEN gearbeitet wird - im Tool
    // "Auftrag von". onOffice fuehrt: steht dort ein Tag, das wir
    // zuordnen koennen, gilt es.
    //
    // Steht dort KEINS, bleibt der lokale Wert stehen. Nicht aus
    // Vorsicht, sondern weil sonst ein im Tool gesetzter Auftraggeber
    // beim naechsten Lauf verschwaende - der Weg nach drueben liegt
    // dann ja womoeglich noch vor uns.
    const tag = aufgabe.tags[0];
    if (tag) {
      zeile.onoffice_tag = tag;
      const treffer = tags.nachTag.get(normalisiere(tag));
      if (treffer) {
        if (treffer !== vorhandene?.broker_contact_id) ergebnis.tagsZugeordnet++;
        zeile.broker_contact_id = treffer;
      } else {
        // null heisst mehrdeutig, undefined heisst unbekannt - beides
        // ist ein Fall fuer einen Menschen, nicht fuer eine Vermutung.
        tagsOhneZuordnung.add(tag);
      }
    }

    if (aufgabe.status === "erledigt") {
      zeile.completed_at = modified ?? new Date().toISOString();
    } else {
      zeile.completed_at = null;
      zeile.completed_by = null;
    }

    try {
      if (vorhandene) {
        const { error } = await sb.from("tasks").update(zeile).eq("id", vorhandene.id);
        if (error) throw new Error(error.message);
        angefasst.push({ onofficeTaskId: aufgabe.id, taskId: vorhandene.id });
        ergebnis.aktualisiert++;
      } else {
        const { data: angelegt, error } = await sb
          .from("tasks")
          .insert(zeile)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        if (angelegt?.id) angefasst.push({ onofficeTaskId: aufgabe.id, taskId: angelegt.id });
        ergebnis.neu++;
      }
      ergebnis.uebernommen++;
    } catch (err) {
      ergebnis.fehler.push(`Aufgabe ${aufgabe.id}: ${(err as Error).message}`);
    }
  }

  // Was hier entstanden ist und drueben fehlt, nachtraeglich anlegen.
  // Damit heilt ein fehlgeschlagener erster Versuch von selbst, statt
  // dass eine Aufgabe fuer immer nur im Tool existiert.
  try {
    const { angelegt, fehler } = await legeFehlendeAn();
    if (angelegt) ergebnis.hinweise.push(`${angelegt} Aufgabe(n) in onOffice nachgetragen.`);
    for (const f of fehler.slice(0, 5)) ergebnis.hinweise.push(f);
  } catch (err) {
    ergebnis.hinweise.push(`Nachtragen fehlgeschlagen: ${(err as Error).message}`);
  }

  // Und die Verknuepfungen, die beim Anlegen nicht ankamen.
  try {
    const { verknuepft, fehler } = await zieheVerknuepfungenNach();
    if (verknuepft) ergebnis.hinweise.push(`${verknuepft} Verknüpfung(en) nachgezogen.`);
    for (const f of fehler.slice(0, 5)) ergebnis.hinweise.push(f);
  } catch (err) {
    ergebnis.hinweise.push(`Verknüpfen fehlgeschlagen: ${(err as Error).message}`);
  }

  // Dateien: nur die Nummern, ein Aufruf fuer alle Aufgaben des Laufs.
  // Die Inhalte holt der Dateijob nach. Ein Fehler hier darf den
  // Aufgabenabgleich nicht kippen - deshalb nur ein Hinweis, kein Fehler:
  // sonst bliebe der Merker stehen und derselbe Zeitraum kaeme ewig wieder.
  try {
    const { erfasst, fehler } = await erfasseAnhangIds(angefasst);
    ergebnis.anhaengeErfasst = erfasst;
    for (const f of fehler) ergebnis.hinweise.push(f);
  } catch (err) {
    ergebnis.hinweise.push(`Dateien nicht erfasst: ${(err as Error).message}`);
  }

  // Objekt und Kunde: die Verknuepfungen liegen nicht in den Feldern
  // der Aufgabe, sondern in den Relationen. Zwei Aufrufe fuer den
  // ganzen Lauf - siehe holeVerknuepfungen, dort steht auch, warum
  // das vorher nie ankam.
  try {
    const { gefuellt, fehler } = await holeVerknuepfungen(angefasst);
    ergebnis.verknuepfungenGeholt = gefuellt;
    if (gefuellt) {
      ergebnis.hinweise.push(`${gefuellt} Objekt-/Kundenverknüpfung(en) aus onOffice geholt.`);
    }
    for (const f of fehler.slice(0, 5)) ergebnis.hinweise.push(f);
  } catch (err) {
    ergebnis.hinweise.push(`Verknüpfungen nicht geholt: ${(err as Error).message}`);
  }

  ergebnis.unbekannteTags = [...tagsOhneZuordnung].sort();
  if (ergebnis.unbekannteTags.length) {
    ergebnis.hinweise.push(
      `Diese Tags gehören zu keinem eindeutigen Kollegen: ${ergebnis.unbekannteTags
        .slice(0, 10)
        .join(", ")}. In der Verwaltung unter Kollegen als onOffice-Tag eintragen.`,
    );
  }
  if (ergebnis.tagsZugeordnet) {
    ergebnis.hinweise.push(`${ergebnis.tagsZugeordnet}× „Auftrag von“ aus dem Tag übernommen.`);
  }

  ergebnis.unbekannteNamen = [...unbekannt].sort();
  ergebnis.gefundeneNamen = [...zaehler.entries()]
    .map(([name, anzahl]) => ({ name, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, "de"));
  ergebnis.bisModified = maxModified;

  // Merker nur fortschreiben, wenn nichts schiefging - sonst wuerde ein
  // Fehler dauerhaft Aufgaben verschlucken. Bei einem Erkundungslauf
  // erst recht nicht: er hat nichts uebernommen, und ein vorgerueckter
  // Merker wuerde genau die Aufgaben ueberspringen, um die es geht.
  if (!ergebnis.fehler.length && !ergebnis.erkundung && maxModified) {
    await sb.from("onoffice_sync_cursor").upsert({
      resource: "task",
      last_modified_seen: maxModified,
      last_run_at: new Date().toISOString(),
      initial_done: true,
    });
  }

  await sb.from("onoffice_sync_log").insert({
    direction: "pull",
    resource: "task",
    reference: `seit ${seit}`,
    ok: ergebnis.fehler.length === 0,
    message: ergebnis.erkundung
      ? `Erkundung: ${ergebnis.gelesen} gelesen, nichts uebernommen ` +
        `(noch keine Zuordnung), ${ergebnis.gefundeneNamen.length} Namen gefunden`
      : `${ergebnis.gelesen} gelesen, ${ergebnis.uebernommen} uebernommen ` +
        `(${ergebnis.neu} neu, ${ergebnis.aktualisiert} aktualisiert), ` +
        `${ergebnis.uebersprungen} uebersprungen, ` +
        `${ergebnis.altlasten} abgeschlossene nicht geholt, ` +
        `${ergebnis.anhaengeErfasst} neue Dateien entdeckt`,
    payload: {
      unbekannteNamen: ergebnis.unbekannteNamen.slice(0, 50),
      fehler: ergebnis.fehler.slice(0, 20),
      // Die Hinweise gehoerten von Anfang an hierher. Sie sagen, was
      // der Lauf NICHT konnte - welches Feld der Mandant abgelehnt
      // hat, welches Tag zu niemandem passte. Ohne sie steht im
      // Protokoll "73 uebernommen" und alles sieht gut aus, waehrend
      // die Haelfte der Arbeit still ausgefallen ist.
      hinweise: ergebnis.hinweise.slice(0, 20),
      tagsZugeordnet: ergebnis.tagsZugeordnet,
      unbekannteTags: ergebnis.unbekannteTags.slice(0, 30),
      verknuepfungenGeholt: ergebnis.verknuepfungenGeholt,
    },
  });

  return ergebnis;
}
