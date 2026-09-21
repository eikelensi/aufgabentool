/**
 * Mails zu einem Statuswechsel.
 *
 * "Rückfragen offen": die Pflichtnotiz geht an den Verantwortlichen und an
 * den zugeordneten Kollegen.
 * "Erledigt": der Kollege wird informiert.
 *
 * Private Aufgaben loesen nichts aus - sie sind nur fuer den Ersteller da.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil } from "@/lib/supabase/profil";
import {
  datumDeutsch,
  leeresErgebnis,
  sendeBenachrichtigung,
  zaehle,
} from "@/lib/mail/versand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  const { taskId, status } = (await request.json().catch(() => ({}))) as {
    taskId?: string;
    status?: string;
  };

  if (!taskId || !status) {
    return NextResponse.json({ fehler: "taskId und status fehlen." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const { data: aufgabe, error } = await sb
    .from("tasks")
    .select(
      `id, title, status, is_private, in_progress_note, completed_at, last_status_change_at,
       onoffice_estate_no, onoffice_estate_id,
       creator:profiles!tasks_creator_id_fkey ( id, full_name, email ),
       bearbeiter:profiles!tasks_assignee_id_fkey ( id, full_name, email ),
       makler:broker_contacts ( id, display_name, email )`,
    )
    .eq("id", taskId)
    .maybeSingle();

  if (error) return NextResponse.json({ fehler: error.message }, { status: 500 });
  if (!aufgabe) return NextResponse.json({ fehler: "Aufgabe nicht gefunden." }, { status: 404 });

  // Sichtbarkeit: wer die Aufgabe nicht sehen darf, loest auch keine Mail aus.
  const { data: sichtbar } = await sb.from("tasks").select("id").eq("id", taskId).maybeSingle();
  if (!sichtbar) return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });

  if (aufgabe.is_private) {
    return NextResponse.json({ meldung: "Private Aufgabe – keine Benachrichtigung.", verschickt: 0 });
  }

  const creator = aufgabe.creator as unknown as { full_name: string; email: string } | null;
  const bearbeiter = aufgabe.bearbeiter as unknown as { full_name: string; email: string } | null;
  const makler = aufgabe.makler as unknown as { display_name: string; email: string } | null;

  const vars = {
    titel: aufgabe.title,
    bearbeiter: bearbeiter?.full_name ?? profil.fullName,
    ersteller: creator?.full_name ?? "",
    notiz: aufgabe.in_progress_note ?? "",
    objekt: aufgabe.onoffice_estate_no ?? aufgabe.onoffice_estate_id ?? "–",
    datum: datumDeutsch(aufgabe.completed_at ?? new Date().toISOString()),
    faellig: "",
    tage: "",
  };

  const ergebnis = leeresErgebnis();

  try {
    if (status === "in_bearbeitung") {
      // Der Zeitstempel des Statuswechsels macht den Schluessel eindeutig:
      // eine neue Notiz beim naechsten Wechsel darf wieder mailen, dieselbe
      // nicht zweimal.
      const anlass = aufgabe.last_status_change_at ?? "";
      for (const e of [
        creator ? { email: creator.email, name: creator.full_name, rolle: "verantwortung" } : null,
        makler ? { email: makler.email, name: makler.display_name, rolle: "makler" } : null,
      ]) {
        if (!e) continue;
        zaehle(
          ergebnis,
          await sendeBenachrichtigung({
            taskId: aufgabe.id,
            kind: "in_bearbeitung_notiz",
            empfaenger: { email: e.email, name: e.name },
            dedupeKey: `task:${aufgabe.id}:in_bearbeitung_notiz:${e.rolle}:${anlass}`,
            vars,
          }),
          `${e.email}: Versand fehlgeschlagen`,
        );
      }
    } else if (status === "erledigt") {
      if (makler) {
        zaehle(
          ergebnis,
          await sendeBenachrichtigung({
            taskId: aufgabe.id,
            kind: "aufgabe_erledigt_makler",
            empfaenger: { email: makler.email, name: makler.display_name },
            dedupeKey: `task:${aufgabe.id}:erledigt:${aufgabe.completed_at ?? ""}`,
            vars,
          }),
          `${makler.email}: Versand fehlgeschlagen`,
        );
      }
    }
  } catch (err) {
    return NextResponse.json({ fehler: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({
    verschickt: ergebnis.verschickt,
    uebersprungen: ergebnis.uebersprungen,
    fehler: ergebnis.fehler,
  });
}
