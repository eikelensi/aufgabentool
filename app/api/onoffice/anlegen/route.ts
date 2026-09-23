/**
 * Eine im Tool angelegte Aufgabe auch in onOffice anlegen.
 *
 * Bis hierher war der Abgleich einseitig: was aus onOffice kam, wurde
 * hier gefuehrt, was hier entstand, blieb hier. Das faellt spaetestens
 * auf, wenn jemand in onOffice nach einer Aufgabe sucht, die es dort nie
 * gab - oder wenn der Bearbeiter drueben arbeitet und den Auftrag nicht
 * findet.
 *
 * Wer drueben eingetragen wird:
 *  - Bearbeiter    = der Bearbeiter im Tool (sein onOffice-Kuerzel),
 *  - Verantwortung = wer die Aufgabe angelegt hat.
 * Fehlt zu einer Person das Kuerzel, bleibt das Feld leer statt falsch:
 * ein Name, den onOffice nicht kennt, ist schlimmer als keiner.
 *
 * Private Aufgaben gehen NICHT hinueber. Sie sind im Tool nur fuer ihren
 * Urheber sichtbar; sie ins CRM zu stellen, wo das halbe Haus mitliest,
 * waere ein Wortbruch.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil } from "@/lib/supabase/profil";
import { createTask } from "@/lib/onoffice/tasks";
import { pruefeSchreibsperre } from "@/lib/onoffice/schreibsperre";
import type { TaskPriority, TaskStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function onofficeName(
  sb: ReturnType<typeof supabaseAdmin>,
  profileId: string | null,
): Promise<string> {
  if (!profileId) return "";
  const { data } = await sb
    .from("profiles")
    .select("onoffice_display_name")
    .eq("id", profileId)
    .maybeSingle();
  return data?.onoffice_display_name?.trim() ?? "";
}

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  const { taskId } = (await request.json().catch(() => ({}))) as { taskId?: string };
  if (!taskId) return NextResponse.json({ fehler: "taskId fehlt." }, { status: 400 });

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

  if (!aufgabe) return NextResponse.json({ fehler: "Aufgabe nicht gefunden." }, { status: 404 });

  if (aufgabe.onoffice_task_id) {
    return NextResponse.json({
      angelegt: false,
      meldung: `Diese Aufgabe gibt es in onOffice bereits (${aufgabe.onoffice_task_id}).`,
    });
  }

  if (aufgabe.is_private) {
    return NextResponse.json({
      angelegt: false,
      meldung: "Private Aufgaben bleiben im Tool.",
    });
  }

  const sperre = await pruefeSchreibsperre("anlegen");
  if (!sperre.erlaubt) return NextResponse.json({ angelegt: false, meldung: sperre.grund });

  // Der Bearbeiter kann ein Nutzer des Tools ODER ein Kollege ohne
  // Zugang sein - beides landet drueben im selben Feld.
  let bearbeiter = await onofficeName(sb, aufgabe.assignee_id);
  if (!bearbeiter && aufgabe.onoffice_bearbeiter_id) {
    const { data: kollege } = await sb
      .from("broker_contacts")
      .select("short_code")
      .eq("id", aufgabe.onoffice_bearbeiter_id)
      .maybeSingle();
    bearbeiter = kollege?.short_code?.trim() ?? "";
  }

  const verantwortung = await onofficeName(sb, aufgabe.creator_id);

  try {
    const nummer = await createTask({
      subject: aufgabe.title,
      description: aufgabe.description ?? undefined,
      status: (aufgabe.status ?? "offen") as TaskStatus,
      priority: (aufgabe.priority ?? "normal") as TaskPriority,
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
      payload: { durch: profil.email, bearbeiter, verantwortung },
    });

    return NextResponse.json({
      angelegt: true,
      onofficeTaskId: nummer,
      meldung: `In onOffice angelegt, Nummer ${nummer}.`,
    });
  } catch (err) {
    const meldung = (err as Error).message;

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      ok: false,
      message: `Aufgabe konnte in onOffice nicht angelegt werden: ${meldung}`,
      payload: { aufgabe: aufgabe.title, durch: profil.email },
    });

    // Die Aufgabe steht im Tool und bleibt dort. Nur das Gegenstueck
    // fehlt - und der Mensch soll wissen, dass er es drueben nicht
    // findet.
    return NextResponse.json(
      {
        angelegt: false,
        meldung: `Die Aufgabe ist angelegt, onOffice hat sie aber abgelehnt: ${meldung}`,
      },
      { status: 207 },
    );
  }
}
