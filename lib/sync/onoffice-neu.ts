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
       onoffice_estate_id, onoffice_address_id`,
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
      relatedEstateId: aufgabe.onoffice_estate_id ?? undefined,
      relatedAddressId: aufgabe.onoffice_address_id ?? undefined,
    });

    await sb
      .from("tasks")
      .update({
        onoffice_task_id: nummer,
        onoffice_assignee: bearbeiter || null,
        onoffice_responsible: verantwortung || null,
        onoffice_synced_at: new Date().toISOString(),
      })
      .eq("id", aufgabe.id);

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: nummer,
      ok: true,
      message: `Aufgabe in onOffice angelegt: ${aufgabe.title}`,
      payload: { durch, bearbeiter, verantwortung },
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
