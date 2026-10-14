/**
 * Mails zu einem Statuswechsel.
 *
 * "Rückfragen offen": die Pflichtnotiz geht an den Verantwortlichen und an
 * den zugeordneten Kollegen.
 * "Erledigt": der Kollege wird informiert.
 *
 * Private Aufgaben loesen nichts aus - sie sind nur fuer den Ersteller da.
 *
 * Die Verknuepfung zu broker_contacts nennt ausdruecklich ihren
 * Fremdschluessel. Seit tasks zwei davon auf dieselbe Tabelle hat -
 * broker_contact_id (wer den Auftrag gab) und onoffice_bearbeiter_id
 * (wer ihn bearbeitet) - kann PostgREST nicht mehr raten, welcher
 * gemeint ist, und lehnt die ganze Abfrage ab. Ohne den Namen kam hier
 * gar keine Aufgabe mehr an, die Route gab 500 zurueck, und weil der
 * Aufruf im Browser ein "void fetch" ist, sah niemand etwas: keine
 * Mail, kein Protokolleintrag, keine Fehlermeldung.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil } from "@/lib/supabase/profil";
import {
  anredeName,
  aufgabenRahmen,
  datumDeutsch,
  kurzfassung,
  leeresErgebnis,
  sendeBenachrichtigung,
  zaehle,
} from "@/lib/mail/versand";
import { PRIO_LABEL, type TaskPriority } from "@/lib/types";
import { darfSenden } from "@/lib/mail/regeln";

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
      `id, title, description, status, priority, due_date, created_at,
       is_private, in_progress_note, completed_at, last_status_change_at,
       onoffice_task_id, onoffice_estate_no, onoffice_estate_id, onoffice_address_no,
       creator:profiles!tasks_creator_id_fkey ( id, full_name, email ),
       bearbeiter:profiles!tasks_assignee_id_fkey ( id, full_name, email ),
       makler:broker_contacts!tasks_broker_contact_id_fkey ( id, display_name, email ),
       kategorie:categories!tasks_category_id_fkey ( name ),
       art:task_types!tasks_task_type_id_fkey ( label )`,
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

  const creator = aufgabe.creator as unknown as { id: string; full_name: string; email: string } | null;
  const bearbeiter = aufgabe.bearbeiter as unknown as { full_name: string; email: string } | null;
  const makler = aufgabe.makler as unknown as { display_name: string; email: string } | null;

  const kategorie = (aufgabe.kategorie as unknown as { name: string } | null)?.name ?? "";
  const art = (aufgabe.art as unknown as { label: string } | null)?.label ?? "";

  const nummer = aufgabe.onoffice_task_id ?? "";
  const objekt = aufgabe.onoffice_estate_no ?? aufgabe.onoffice_estate_id ?? "";
  const kunde = aufgabe.onoffice_address_no ?? "";
  // Gekuerzt, nicht vollstaendig - die Begruendung steht in kurzfassung().
  const beschreibung = kurzfassung(aufgabe.description, 600, aufgabe.title);

  /**
   * Woran der Kollege die Aufgabe erkennt - in einer Zeile, fuer
   * Betreff und Anrede. Ohne Nummer bleibt der Betreff sauber, statt
   * "#ohne Nummer" zu behaupten.
   */
  const aufgabeKurz = nummer ? `#${nummer} - ${aufgabe.title}` : aufgabe.title;

  const rahmen = [
    aufgabenRahmen([
      ["Aufgabe", aufgabeKurz],
      ["Art", art],
      ["Kategorie", kategorie],
      ["Priorität", PRIO_LABEL[aufgabe.priority as TaskPriority] ?? ""],
      ["Frist", aufgabe.due_date ? datumDeutsch(aufgabe.due_date) : ""],
      ["Objekt", objekt],
      ["Kunde", kunde],
      ["Auftrag von", anredeName(makler?.display_name)],
      ["Bearbeiter", anredeName(bearbeiter?.full_name ?? profil.fullName)],
      ["Verantwortung", anredeName(creator?.full_name)],
      ["Angelegt am", datumDeutsch(aufgabe.created_at)],
    ]),
    beschreibung ? `Beschreibung:\n${beschreibung}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const vars = {
    nummer: nummer || "ohne Nummer",
    aufgabe: aufgabeKurz,
    titel: aufgabe.title,
    beschreibung,
    rahmen,
    art,
    kategorie,
    prio: PRIO_LABEL[aufgabe.priority as TaskPriority] ?? "",
    bearbeiter: anredeName(bearbeiter?.full_name ?? profil.fullName),
    ersteller: anredeName(creator?.full_name),
    makler: anredeName(makler?.display_name),
    notiz: aufgabe.in_progress_note ?? "",
    objekt: objekt || "–",
    kunde: kunde || "–",
    faellig: aufgabe.due_date ? datumDeutsch(aufgabe.due_date) : "ohne Frist",
    angelegt: datumDeutsch(aufgabe.created_at),
    datum: datumDeutsch(aufgabe.completed_at ?? new Date().toISOString()),
    tage: "",
  };

  const ergebnis = leeresErgebnis();

  try {
    if (status === "in_bearbeitung") {
      /**
       * Wessen Einstellung zaehlt hier?
       *
       * Die des EMPFAENGERS, nicht die des Ausloesenden. Wer eine
       * Rueckfrage-Mail nicht will, will sie auch dann nicht, wenn ein
       * anderer die Rueckfrage stellt. Der Makler ist kein Nutzer des
       * Tools - fuer ihn gilt die Hausregel.
       */
      if (!(await darfSenden("in_bearbeitung_notiz", creator?.id))) {
        return NextResponse.json({
          verschickt: 0,
          meldung: "Diese Mitteilung ist abgeschaltet.",
        });
      }
      // Der Zeitstempel des Statuswechsels macht den Schluessel eindeutig:
      // eine neue Notiz beim naechsten Wechsel darf wieder mailen, dieselbe
      // nicht zweimal.
      const anlass = aufgabe.last_status_change_at ?? "";
      for (const e of [
        creator ? { email: creator.email, name: creator.full_name, rolle: "verantwortung" } : null,
        makler ? { email: makler.email, name: anredeName(makler.display_name), rolle: "makler" } : null,
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
      if (makler && (await darfSenden("aufgabe_erledigt_makler"))) {
        zaehle(
          ergebnis,
          await sendeBenachrichtigung({
            taskId: aufgabe.id,
            kind: "aufgabe_erledigt_makler",
            empfaenger: { email: makler.email, name: anredeName(makler.display_name) },
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
