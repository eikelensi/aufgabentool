/**
 * Aufgaben des Tools in onOffice anlegen.
 *
 * Zweimal gebraucht und darum hier, nicht in der Route: einmal sofort,
 * wenn jemand eine Aufgabe anlegt, und einmal nachtraeglich fuer alles,
 * was beim ersten Versuch nicht durchkam. Der zweite Weg ist der
 * wichtigere - ein Fehler in der Schnittstelle darf nicht bedeuten,
 * dass eine Aufgabe fuer immer nur hier existiert.
 */

import { createTask } from "@/lib/onoffice/tasks";
import { findeKunde, findeObjekt } from "@/lib/onoffice/records";
import { verknuepfeAufgabe } from "@/lib/onoffice/relations";
import { pruefeSchreibsperre } from "@/lib/onoffice/schreibsperre";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TaskPriority, TaskStatus } from "@/lib/types";

export interface AnlageErgebnis {
  angelegt: boolean;
  onofficeTaskId?: string;
  meldung: string;
}

/**
 * Welche Aufgabenart neue Aufgaben bekommen.
 *
 * onOffice verlangt das Feld und will eine Zahl - welche, steht
 * nirgends dokumentiert. Also nehmen wir die, die im Bestand am
 * haeufigsten vorkommt: was fuer tausend bestehende Aufgaben richtig
 * ist, wird fuer die naechste nicht falsch sein.
 */
export async function haeufigsteArt(): Promise<string | undefined> {
  if (process.env.ONOFFICE_TASK_ART) return process.env.ONOFFICE_TASK_ART;

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("tasks")
    .select("onoffice_art_raw")
    .not("onoffice_art_raw", "is", null)
    .limit(500);

  const zaehler = new Map<string, number>();
  for (const z of data ?? []) {
    const wert = String(z.onoffice_art_raw ?? "").trim();
    if (/^\d+$/.test(wert)) zaehler.set(wert, (zaehler.get(wert) ?? 0) + 1);
  }

  const beste = [...zaehler.entries()].sort((a, b) => b[1] - a[1])[0];
  return beste?.[0];
}

async function onofficeName(profileId: string | null): Promise<string> {
  if (!profileId) return "";
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("profiles")
    .select("onoffice_display_name")
    .eq("id", profileId)
    .maybeSingle();
  return data?.onoffice_display_name?.trim() ?? "";
}

/**
 * Eine einzelne Aufgabe druebenn anlegen und die Nummer zurueckschreiben.
 *
 * Die Nummer ist der eigentliche Zweck: ohne sie weiss das Tool beim
 * naechsten Abgleich nicht, dass die beiden dasselbe meinen - und legt
 * sie ein zweites Mal an.
 */
export async function legeInOnofficeAn(
  taskId: string,
  durch?: string,
): Promise<AnlageErgebnis> {
  const sb = supabaseAdmin();

  const { data: aufgabe } = await sb
    .from("tasks")
    .select(
      `id, title, description, status, priority, due_date, visible_from, is_private,
       assignee_id, creator_id, onoffice_task_id, onoffice_bearbeiter_id,
       onoffice_estate_id, onoffice_address_id, onoffice_estate_no, onoffice_address_no`,
    )
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe) return { angelegt: false, meldung: "Aufgabe nicht gefunden." };

  if (aufgabe.onoffice_task_id) {
    return {
      angelegt: false,
      onofficeTaskId: aufgabe.onoffice_task_id,
      meldung: `Diese Aufgabe gibt es in onOffice bereits (${aufgabe.onoffice_task_id}).`,
    };
  }

  // Private Aufgaben gehen nie hinueber: im Tool sieht sie nur ihr
  // Urheber, im CRM laese das halbe Haus mit.
  if (aufgabe.is_private) {
    return { angelegt: false, meldung: "Private Aufgaben bleiben im Tool." };
  }

  const sperre = await pruefeSchreibsperre("anlegen");
  if (!sperre.erlaubt) return { angelegt: false, meldung: sperre.grund ?? "Gesperrt." };

  let bearbeiter = await onofficeName(aufgabe.assignee_id);
  if (!bearbeiter && aufgabe.onoffice_bearbeiter_id) {
    const { data: kollege } = await sb
      .from("broker_contacts")
      .select("short_code")
      .eq("id", aufgabe.onoffice_bearbeiter_id)
      .maybeSingle();
    bearbeiter = kollege?.short_code?.trim() ?? "";
  }
  const verantwortung = await onofficeName(aufgabe.creator_id);

  // Die eingetippten Nummern in IDs uebersetzen. Ohne diesen Schritt
  // wird die Aufgabe drueben angelegt und haengt an nichts - und
  // genau die Verknuepfung ist der Grund, warum man eine Nummer
  // ueberhaupt eintippt.
  //
  // Zwei Felder, zwei Suchen, unabhaengig voneinander: eine Aufgabe
  // kann an einem Objekt haengen, an einem Kunden, oder an beidem.
  let estateId = aufgabe.onoffice_estate_id ? String(aufgabe.onoffice_estate_id) : null;
  let addressId = aufgabe.onoffice_address_id ? String(aufgabe.onoffice_address_id) : null;

  const objektNummer = (aufgabe.onoffice_estate_no ?? "").trim();
  const kundenNummer = (aufgabe.onoffice_address_no ?? "").trim();

  if (!estateId && objektNummer) {
    try {
      estateId = await findeObjekt(objektNummer);
    } catch {
      /* dann ohne Objekt */
    }
  }

  if (!addressId && kundenNummer) {
    try {
      addressId = await findeKunde(kundenNummer);
    } catch {
      /* dann ohne Kunden */
    }
  }

  // Wer nur eine Nummer eintippt und sie ins falsche Feld schreibt,
  // soll trotzdem eine Verknuepfung bekommen: findet sich die
  // Objektnummer nicht als Objekt, wird sie als Kundennummer probiert.
  if (!estateId && !addressId && objektNummer) {
    try {
      addressId = await findeKunde(objektNummer);
    } catch {
      /* dann eben ohne */
    }
  }

  if (estateId !== (aufgabe.onoffice_estate_id ?? null) || addressId !== (aufgabe.onoffice_address_id ?? null)) {
    await sb
      .from("tasks")
      .update({ onoffice_estate_id: estateId, onoffice_address_id: addressId })
      .eq("id", aufgabe.id);
  }

  try {
    const nummer = await createTask({
      subject: aufgabe.title,
      description: aufgabe.description ?? undefined,
      status: (aufgabe.status ?? "offen") as TaskStatus,
      priority: (aufgabe.priority ?? "normal") as TaskPriority,
      art: await haeufigsteArt(),
      processor: bearbeiter || undefined,
      responsibility: verantwortung || undefined,
      startDate: aufgabe.visible_from ?? undefined,
      deadline: aufgabe.due_date ?? undefined,
      relatedEstateId: estateId ?? undefined,
      relatedAddressId: addressId ?? undefined,
    });

    // Die Verknuepfungen noch einmal ausdruecklich setzen. Beim
    // Anlegen gehen sie als Beigabe mit - beim Objekt kam das an, beim
    // Kunden nicht, stillschweigend. Also der dokumentierte Weg
    // hinterher, und ein Merker, damit der Abgleich weiss, dass es
    // erledigt ist.
    let verknuepft: string | null = null;
    if (estateId || addressId) {
      const rel = await verknuepfeAufgabe(nummer, { estateId, addressId });
      if (rel.fehler.length === 0) verknuepft = new Date().toISOString();
    }

    await sb
      .from("tasks")
      .update({
        onoffice_task_id: nummer,
        onoffice_assignee: bearbeiter || null,
        onoffice_responsible: verantwortung || null,
        onoffice_synced_at: new Date().toISOString(),
        onoffice_verknuepft_am: verknuepft,
      })
      .eq("id", aufgabe.id);

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: nummer,
      ok: true,
      message: `Aufgabe in onOffice angelegt: ${aufgabe.title}`,
      payload: {
        durch,
        bearbeiter,
        verantwortung,
        estateId,
        addressId,
        objektNummer,
        kundenNummer,
      },
    });

    return {
      angelegt: true,
      onofficeTaskId: nummer,
      meldung: `In onOffice angelegt, Nummer ${nummer}.`,
    };
  } catch (err) {
    const meldung = (err as Error).message;

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      ok: false,
      message: `Aufgabe konnte in onOffice nicht angelegt werden: ${meldung}`,
      payload: { aufgabe: aufgabe.title, durch },
    });

    return {
      angelegt: false,
      meldung: `Die Aufgabe ist angelegt, onOffice hat sie aber abgelehnt: ${meldung}`,
    };
  }
}

/**
 * Nachzuegler: alles, was hier entstanden ist und drueben fehlt.
 *
 * Laeuft mit dem Abgleich alle zwei Minuten. Damit heilt jeder
 * Fehlschlag von selbst - und niemand muss eine Aufgabe von Hand noch
 * einmal anfassen, weil die Schnittstelle einmal gehustet hat.
 */
/**
 * Verknuepfungen nachziehen, die beim Anlegen nicht ankamen.
 *
 * Betrifft alles, was eine Aufgabennummer und eine Objekt- oder
 * Kunden-ID hat, aber keinen Merker - also auch die Aufgaben, die
 * heute Nacht ohne Kundenverknuepfung entstanden sind. Wenige pro
 * Lauf, denn jede kostet einen Aufruf.
 */
export async function zieheVerknuepfungenNach(grenze = 5): Promise<{
  verknuepft: number;
  fehler: string[];
}> {
  const sb = supabaseAdmin();
  const fehler: string[] = [];

  const sperre = await pruefeSchreibsperre("anlegen");
  if (!sperre.erlaubt) return { verknuepft: 0, fehler };

  const { data: offen } = await sb
    .from("tasks")
    .select("id, title, onoffice_task_id, onoffice_estate_id, onoffice_address_id")
    .not("onoffice_task_id", "is", null)
    .is("onoffice_verknuepft_am", null)
    .or("onoffice_estate_id.not.is.null,onoffice_address_id.not.is.null")
    .limit(grenze);

  let verknuepft = 0;
  for (const a of offen ?? []) {
    const rel = await verknuepfeAufgabe(a.onoffice_task_id as string, {
      estateId: a.onoffice_estate_id ? String(a.onoffice_estate_id) : null,
      addressId: a.onoffice_address_id ? String(a.onoffice_address_id) : null,
    });

    if (rel.fehler.length === 0) {
      await sb
        .from("tasks")
        .update({ onoffice_verknuepft_am: new Date().toISOString() })
        .eq("id", a.id);
      verknuepft++;
    } else {
      fehler.push(`${a.title}: ${rel.fehler.join("; ")}`);
    }
  }

  return { verknuepft, fehler };
}

export async function legeFehlendeAn(grenze = 10): Promise<{
  angelegt: number;
  fehler: string[];
}> {
  const sb = supabaseAdmin();
  const fehler: string[] = [];

  const sperre = await pruefeSchreibsperre("anlegen");
  if (!sperre.erlaubt) return { angelegt: 0, fehler };

  const { data: offen } = await sb
    .from("tasks")
    .select("id, title")
    .is("onoffice_task_id", null)
    .eq("bereich", "task")
    .eq("is_private", false)
    .neq("status", "erledigt")
    .order("created_at", { ascending: true })
    .limit(grenze);

  let angelegt = 0;
  for (const a of offen ?? []) {
    const res = await legeInOnofficeAn(a.id, "Nachzuegler");
    if (res.angelegt) angelegt++;
    else if (!res.meldung.startsWith("Private")) fehler.push(`${a.title}: ${res.meldung}`);
  }

  return { angelegt, fehler };
}
