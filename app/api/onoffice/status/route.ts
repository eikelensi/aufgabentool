/**
 * Einen Statuswechsel nach onOffice zurueckschreiben.
 *
 * Ausgeloest, wenn im Tool der Status einer Aufgabe wechselt. Geschrieben
 * wird genau EIN Feld: "Status". Kein Betreff, keine Frist, keine Notiz.
 *
 * Der Grund fuer die Vorsicht steht in lib/onoffice/mapping.ts: onOffice
 * kennt acht Status, das Tool drei. "Zurueckgestellt", "Abgebrochen" und
 * "Sonstiges" sehen bei uns alle wie "Offen" aus. Wer beim
 * Zurueckschreiben stumpf "offen -> Nicht begonnen" setzt, macht aus
 * einer zurueckgestellten Aufgabe eine nicht begonnene, und niemand
 * merkt es, weil im Tool beides gleich heisst.
 *
 * Deshalb die Regel: geschrieben wird nur, wenn der Status bei UNS sich
 * gegenueber dem zuletzt aus onOffice gelesenen Rohwert wirklich
 * unterscheidet. Steht dort "Zurueckgestellt" und bei uns "Offen", ist
 * nichts passiert - also wird nichts angefasst.
 *
 * Wie beim Bearbeiter:
 *  - nur fuer die eigene Aufgabe (oder als Admin),
 *  - gesperrt durch sync_read_only und sync_push_status,
 *  - protokolliert, gelungen wie gescheitert,
 *  - und ein Fehlschlag laesst den Statuswechsel im Tool stehen. Eine
 *    hakende Schnittstelle darf niemanden an seiner Arbeit hindern.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import { pushStatus } from "@/lib/onoffice/tasks";
import { onofficeStatusLabel, toOnofficeStatus, toOurStatus } from "@/lib/onoffice/mapping";
import { pruefeSchreibsperre } from "@/lib/onoffice/schreibsperre";
import { STATUS_LABEL, type TaskStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  const { taskId } = (await request.json().catch(() => ({}))) as { taskId?: string };
  if (!taskId) return NextResponse.json({ fehler: "taskId fehlt." }, { status: 400 });

  const sb = supabaseAdmin();

  const { data: aufgabe } = await sb
    .from("tasks")
    .select("id, title, status, assignee_id, creator_id, onoffice_task_id, onoffice_status_raw")
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe) return NextResponse.json({ fehler: "Aufgabe nicht gefunden." }, { status: 404 });

  const eigene = aufgabe.assignee_id === profil.id || aufgabe.creator_id === profil.id;
  if (!eigene && !istAdmin(profil)) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  if (!aufgabe.onoffice_task_id) {
    return NextResponse.json({
      uebertragen: false,
      meldung: "Diese Aufgabe hat kein Gegenstück in onOffice.",
    });
  }

  const sperre = await pruefeSchreibsperre("status");
  if (!sperre.erlaubt) {
    return NextResponse.json({ uebertragen: false, meldung: sperre.grund });
  }

  const unser = aufgabe.status as TaskStatus;
  const rohVorher = aufgabe.onoffice_status_raw ?? null;

  // Die Regel, die den Schaden verhindert: nur schreiben, wenn sich der
  // Status in UNSEREN Begriffen unterscheidet.
  if (rohVorher && toOurStatus(rohVorher) === unser) {
    return NextResponse.json({
      uebertragen: false,
      meldung:
        `In onOffice steht „${rohVorher}“ – das bedeutet bei uns bereits ` +
        `„${STATUS_LABEL[unser]}“. Es gibt nichts zu übertragen.`,
    });
  }

  const wert = toOnofficeStatus(unser);
  const label = onofficeStatusLabel(wert);

  try {
    await pushStatus(aufgabe.onoffice_task_id, unser);

    // Den Rohwert mitschreiben, sonst wuerde der naechste Statuswechsel
    // wieder gegen den alten Stand vergleichen.
    await sb
      .from("tasks")
      .update({ onoffice_status_raw: label, onoffice_synced_at: new Date().toISOString() })
      .eq("id", aufgabe.id);

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: aufgabe.onoffice_task_id,
      ok: true,
      message: `Status auf "${label}" (${wert}) gesetzt, vorher "${rohVorher ?? "unbekannt"}"`,
      payload: { aufgabe: aufgabe.title, durch: profil.email, unser },
    });

    return NextResponse.json({
      uebertragen: true,
      meldung: `In onOffice auf „${label}“ gesetzt.`,
    });
  } catch (err) {
    const meldung = (err as Error).message;

    await sb.from("onoffice_sync_log").insert({
      direction: "push",
      resource: "task",
      reference: aufgabe.onoffice_task_id,
      ok: false,
      message: `Status konnte nicht gesetzt werden: ${meldung}`,
      payload: { aufgabe: aufgabe.title, durch: profil.email, wollte: wert },
    });

    return NextResponse.json(
      {
        uebertragen: false,
        meldung: `Der Status ist im Tool gesetzt, onOffice hat ihn aber abgelehnt: ${meldung}`,
      },
      { status: 207 },
    );
  }
}
