/**
 * Meldung, wenn eine Aufgabe zurueck in den Pool gelegt wird.
 *
 * Geht an die Adresse aus app_settings.pool_notify_email (Vorgabe
 * hilfe@4-wk.de) und nennt: Aufgabennummer, Titel, wer zurueckgelegt
 * hat, fuer welchen Auftraggeber, und die Begruendung.
 *
 * Warum ueberhaupt eine Mail: eine Aufgabe, die zurueckkommt, ist ein
 * Vorgang, der jemandem auffallen soll. Sie verschwindet sonst leise
 * im Pool, und dass sie dort schon zum dritten Mal liegt, sieht
 * niemand.
 *
 * Die Begruendung steht ausserdem an der Aufgabe selbst - das schreibt
 * der Aufrufer, bevor er hier klingelt. Diese Route liest nur.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil } from "@/lib/supabase/profil";
import { datumDeutsch, leeresErgebnis, sendeBenachrichtigung, zaehle } from "@/lib/mail/versand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  const { taskId } = (await request.json().catch(() => ({}))) as { taskId?: string };
  if (!taskId) return NextResponse.json({ fehler: "taskId fehlt." }, { status: 400 });

  const sb = supabaseAdmin();

  const [{ data: aufgabe, error }, { data: einst }] = await Promise.all([
    sb
      .from("tasks")
      .select(
        `id, title, onoffice_task_id, is_private, pool_grund, pool_zurueck_am,
         zurueck:profiles!tasks_pool_zurueck_von_fkey ( full_name, email ),
         makler:broker_contacts!tasks_broker_contact_id_fkey ( display_name )`,
      )
      .eq("id", taskId)
      .maybeSingle(),
    sb.from("app_settings").select("pool_notify_email").maybeSingle(),
  ]);

  if (error) return NextResponse.json({ fehler: error.message }, { status: 500 });
  if (!aufgabe) return NextResponse.json({ fehler: "Aufgabe nicht gefunden." }, { status: 404 });

  // Private Aufgaben gehen niemanden etwas an, auch nicht die Hilfe.
  if (aufgabe.is_private) {
    return NextResponse.json({ meldung: "Private Aufgabe – keine Meldung.", verschickt: 0 });
  }

  const empfaenger = (einst?.pool_notify_email ?? "").trim();
  if (!empfaenger) {
    return NextResponse.json({
      verschickt: 0,
      meldung: "Für Pool-Meldungen ist keine Empfängeradresse hinterlegt (Einstellungen).",
    });
  }

  const zurueck = aufgabe.zurueck as unknown as { full_name: string } | null;
  const makler = aufgabe.makler as unknown as { display_name: string } | null;

  const ergebnis = leeresErgebnis();

  try {
    zaehle(
      ergebnis,
      await sendeBenachrichtigung({
        taskId: aufgabe.id,
        kind: "aufgabe_in_pool",
        empfaenger: { email: empfaenger },
        // Der Zeitpunkt macht den Schluessel eindeutig: dieselbe Aufgabe
        // darf beim naechsten Mal wieder melden, dieselbe Rueckgabe nicht
        // zweimal.
        dedupeKey: `task:${aufgabe.id}:in_pool:${aufgabe.pool_zurueck_am ?? ""}`,
        vars: {
          nummer: aufgabe.onoffice_task_id ?? "ohne Nummer",
          titel: aufgabe.title,
          bearbeiter: zurueck?.full_name ?? profil.fullName,
          makler: makler?.display_name ?? "nicht hinterlegt",
          grund: aufgabe.pool_grund?.trim() || "(keine Begründung angegeben)",
          datum: datumDeutsch(aufgabe.pool_zurueck_am ?? new Date().toISOString()),
          bearbeiterMail: "",
          objekt: "",
          notiz: "",
          ersteller: "",
          faellig: "",
          tage: "",
        },
      }),
      `${empfaenger}: Versand fehlgeschlagen`,
    );
  } catch (err) {
    return NextResponse.json({ fehler: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({
    verschickt: ergebnis.verschickt,
    uebersprungen: ergebnis.uebersprungen,
    fehler: ergebnis.fehler,
    an: empfaenger,
  });
}
