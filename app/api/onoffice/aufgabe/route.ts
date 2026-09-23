/**
 * Betreff, Beschreibung, Frist und Prioritaet nach onOffice zurueckschreiben.
 *
 * Warum das sein muss: onOffice fuehrt bei genau diesen Feldern. Eine
 * Aenderung, die nur hier steht, ist nach dem naechsten Abgleich wieder
 * weg - fuenf Minuten spaeter, ohne Vorwarnung. Bearbeiten im Tool ohne
 * diesen Weg waere ein Versprechen, das der naechste Lauf bricht.
 *
 * Geschrieben wird nur, was der Aufrufer ausdruecklich nennt. Die Route
 * liest den gewuenschten Stand aus der eigenen Datenbank - der Client hat
 * ihn vorher dort gespeichert - und uebertraegt daraus die genannten
 * Felder. So kann eine verschluckte Antwort nichts anrichten, was nicht
 * ohnehin schon gespeichert ist.
 *
 * Abschaltbar mit sync_push_inhalt einzeln, mit sync_read_only zusammen
 * mit allem anderen. Scheitert die Uebertragung, bleibt die Aenderung im
 * Tool bestehen und die Meldung sagt, dass onOffice sie nicht hat.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import { modifyTask } from "@/lib/onoffice/tasks";
import { toOnofficePriority } from "@/lib/onoffice/mapping";
import { pruefeSchreibsperre } from "@/lib/onoffice/schreibsperre";
import type { TaskPriority } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Was der Client anfordern darf - und wie es drueben heisst. */
const ERLAUBT = ["titel", "beschreibung", "faelligkeit", "prioritaet"] as const;
type Feld = (typeof ERLAUBT)[number];

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  const { taskId, felder } = (await request.json().catch(() => ({}))) as {
    taskId?: string;
    felder?: string[];
  };

  if (!taskId) return NextResponse.json({ fehler: "taskId fehlt." }, { status: 400 });

  const gewuenscht = (felder ?? []).filter((f): f is Feld =>
    (ERLAUBT as readonly string[]).includes(f),
  );
  if (!gewuenscht.length) {
    return NextResponse.json({ uebertragen: false, meldung: "Kein übertragbares Feld genannt." });
  }

  const sb = supabaseAdmin();

  const { data: aufgabe } = await sb
    .from("tasks")
    .select(
      "id, onoffice_task_id, assignee_id, creator_id, title, description, due_date, priority",
    )
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe) return NextResponse.json({ fehler: "Aufgabe nicht gefunden." }, { status: 404 });

  const darf =
    aufgabe.assignee_id === profil.id || aufgabe.creator_id === profil.id || istAdmin(profil);
  if (!darf) return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });

  if (!aufgabe.onoffice_task_id) {
    return NextResponse.json({
      uebertragen: false,
      meldung: "Diese Aufgabe hat kein Gegenstück in onOffice.",
    });
  }

  const sperre = await pruefeSchreibsperre("inhalt");
  if (!sperre.erlaubt) {
    return NextResponse.json({ uebertragen: false, meldung: sperre.grund });
  }

  // Die Feldnamen sind die des Mandanten, geprueft beim Anlegen einer
  // Aufgabe: Betreff, Aufgabe (der Text), Deadline.
  const daten: Record<string, string> = {};
  for (const feld of gewuenscht) {
    if (feld === "titel") daten.Betreff = aufgabe.title ?? "";
    if (feld === "beschreibung") daten.Aufgabe = aufgabe.description ?? "";
    // Eine geleerte Frist muss drueben auch leer werden, sonst holt der
    // naechste Abgleich das alte Datum zurueck.
    if (feld === "faelligkeit") daten.Deadline = aufgabe.due_date ?? "";
    if (feld === "prioritaet") {
      daten.Prio = toOnofficePriority((aufgabe.priority ?? "normal") as TaskPriority);
    }
  }

  try {
    await modifyTask(aufgabe.onoffice_task_id, daten);

    await sb
      .from("tasks")
      .update({ onoffice_synced_at: new Date().toISOString() })
      .eq("id", aufgabe.id);

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: aufgabe.onoffice_task_id,
      ok: true,
      message: `Inhalt geändert: ${Object.keys(daten).join(", ")}`,
      payload: { aufgabe: aufgabe.title, durch: profil.email },
    });

    return NextResponse.json({
      uebertragen: true,
      meldung: `In onOffice geändert: ${Object.keys(daten).join(", ")}.`,
    });
  } catch (err) {
    const meldung = (err as Error).message;

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: aufgabe.onoffice_task_id,
      ok: false,
      message: `Inhalt konnte nicht geändert werden: ${meldung}`,
      payload: { aufgabe: aufgabe.title, durch: profil.email, felder: Object.keys(daten) },
    });

    return NextResponse.json(
      {
        uebertragen: false,
        // Deutlich gesagt: im Tool steht es, drueben nicht - und beim
        // naechsten Abgleich gewinnt drueben.
        meldung:
          `Gespeichert, aber onOffice hat die Änderung abgelehnt: ${meldung} ` +
          "Solange sie dort nicht ankommt, wird sie beim nächsten Abgleich überschrieben.",
      },
      { status: 207 },
    );
  }
}
