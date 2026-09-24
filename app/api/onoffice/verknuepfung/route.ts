/**
 * Objekt und Kunde einer bestehenden Aufgabe nachtraeglich verknuepfen.
 *
 * Bisher ging das nur beim Anlegen. Wer eine Aufgabe aus onOffice
 * bekam, bei der das Objekt fehlte, konnte es nirgends nachtragen -
 * und weil onOffice die Verknuepfung auch nicht im Aufgabendatensatz
 * herausgibt, blieb das Feld fuer immer leer.
 *
 * Der Aufrufer schickt, was jemand eingetippt hat: Objektnummer,
 * Kundennummer, oder eine Datensatz-ID. Was daraus wird, entscheidet
 * onOffice - findeObjekt und findeKunde probieren die Nummernarten der
 * Reihe nach durch, statt den Benutzer raten zu lassen, welche gemeint
 * ist.
 *
 * Geschrieben wird beides: die Relation drueben und ID plus Nummer
 * hier. Eine Nummer, die sich nicht aufloesen laesst, wird NICHT
 * gespeichert - ein Feld, in dem eine erfundene Objektnummer steht,
 * ist schlimmer als ein leeres.
 *
 * Leeren ist ausdruecklich erlaubt (leerer String): dann wird die
 * Verknuepfung hier entfernt. In onOffice bleibt sie stehen - die API
 * kennt kein Loeschen von Relationen. Das sagt die Antwort auch.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil } from "@/lib/supabase/profil";
import { findeKunde, findeObjekt, kundenNummern, objektNummern } from "@/lib/onoffice/records";
import { verknuepfeAufgabe } from "@/lib/onoffice/relations";
import { onofficeConfigured } from "@/lib/onoffice/client";
import { pruefeSchreibsperre } from "@/lib/onoffice/schreibsperre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  // Verknuepfen greift in fremde CRM-Daten ein. Wer verteilt, darf das -
  // wer nur abarbeitet, nicht.
  if (!["superadmin", "gf", "qm"].includes(profil.role)) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  const { taskId, objektnummer, kundennummer } = (await request
    .json()
    .catch(() => ({}))) as {
    taskId?: string;
    objektnummer?: string;
    kundennummer?: string;
  };

  if (!taskId) return NextResponse.json({ fehler: "taskId fehlt." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: aufgabe } = await sb
    .from("tasks")
    .select("id, title, onoffice_task_id")
    .eq("id", taskId)
    .maybeSingle();

  if (!aufgabe) return NextResponse.json({ fehler: "Aufgabe nicht gefunden." }, { status: 404 });

  const zeile: Record<string, unknown> = {};
  const meldungen: string[] = [];
  let estateId: string | null = null;
  let addressId: string | null = null;

  const aufloesen = async (
    wert: string,
    was: "objekt" | "kunde",
  ): Promise<string | null | undefined> => {
    const eingabe = wert.trim();

    // Leer heisst: Verknuepfung weg. Kein Aufloesen noetig.
    if (!eingabe) return null;

    if (!onofficeConfigured()) {
      meldungen.push("onOffice ist in dieser Umgebung nicht eingerichtet – nur hier gespeichert.");
      return undefined;
    }

    const id = was === "objekt" ? await findeObjekt(eingabe) : await findeKunde(eingabe);
    if (!id) {
      meldungen.push(
        was === "objekt"
          ? `Zu der Objektnummer „${eingabe}“ findet onOffice kein Objekt – nicht gespeichert.`
          : `Zu der Kundennummer „${eingabe}“ findet onOffice keinen Datensatz – nicht gespeichert.`,
      );
      return undefined;
    }
    return id;
  };

  if (typeof objektnummer === "string") {
    const id = await aufloesen(objektnummer, "objekt");
    if (id !== undefined) {
      estateId = id;
      zeile.onoffice_estate_id = id;
      // Die eingetippte Nummer ist nicht unbedingt die Objektnummer -
      // es kann die interne Nummer oder die ID gewesen sein. Also die
      // richtige holen, statt die Eingabe zu spiegeln.
      zeile.onoffice_estate_no = id
        ? (await objektNummern([id])).get(id) ?? objektnummer.trim()
        : null;
    }
  }

  if (typeof kundennummer === "string") {
    const id = await aufloesen(kundennummer, "kunde");
    if (id !== undefined) {
      addressId = id;
      zeile.onoffice_address_id = id;
      zeile.onoffice_address_no = id
        ? (await kundenNummern([id])).get(id) ?? kundennummer.trim()
        : null;
    }
  }

  if (!Object.keys(zeile).length) {
    return NextResponse.json({
      uebertragen: false,
      meldung: meldungen.join(" ") || "Nichts zu verknüpfen.",
    });
  }

  const { error } = await sb.from("tasks").update(zeile).eq("id", aufgabe.id);
  if (error) return NextResponse.json({ fehler: error.message }, { status: 500 });

  // Und nun drueben. Ohne Aufgabennummer gibt es dort nichts zu
  // verknuepfen; das Nachtragen uebernimmt dann legeFehlendeAn.
  if (!aufgabe.onoffice_task_id) {
    return NextResponse.json({
      uebertragen: false,
      meldung: [
        "Hier gespeichert. Diese Aufgabe hat noch kein Gegenstück in onOffice –",
        "die Verknüpfung geht mit, sobald sie dort angelegt ist.",
        ...meldungen,
      ].join(" "),
    });
  }

  const sperre = await pruefeSchreibsperre("anlegen");
  if (!sperre.erlaubt) {
    return NextResponse.json({
      uebertragen: false,
      meldung: `Hier gespeichert. ${sperre.grund}`,
    });
  }

  if (!estateId && !addressId) {
    return NextResponse.json({
      uebertragen: false,
      meldung: [
        "Hier entfernt. In onOffice bleibt die Verknüpfung stehen –",
        "die Schnittstelle kann Relationen nicht löschen. Wenn sie weg soll,",
        "muss das in onOffice geschehen.",
        ...meldungen,
      ].join(" "),
    });
  }

  const rel = await verknuepfeAufgabe(aufgabe.onoffice_task_id, { estateId, addressId });

  await sb.from("onoffice_sync_log").insert({
    direction: "push",
    resource: "task",
    reference: aufgabe.onoffice_task_id,
    ok: rel.fehler.length === 0,
    message:
      rel.fehler.length === 0
        ? `Verknüpft: ${[estateId && `Objekt ${estateId}`, addressId && `Kunde ${addressId}`]
            .filter(Boolean)
            .join(", ")}`
        : `Verknüpfen fehlgeschlagen: ${rel.fehler.join("; ")}`,
    payload: { aufgabe: aufgabe.title, durch: profil.email },
  });

  if (rel.fehler.length) {
    await sb
      .from("tasks")
      .update({ onoffice_verknuepft_am: null })
      .eq("id", aufgabe.id);

    return NextResponse.json(
      {
        uebertragen: false,
        meldung: [
          `Hier gespeichert, onOffice hat die Verknüpfung abgelehnt: ${rel.fehler.join("; ")}.`,
          "Der Abgleich versucht es von selbst noch einmal.",
          ...meldungen,
        ].join(" "),
      },
      { status: 207 },
    );
  }

  await sb
    .from("tasks")
    .update({ onoffice_verknuepft_am: new Date().toISOString() })
    .eq("id", aufgabe.id);

  return NextResponse.json({
    uebertragen: true,
    meldung: [
      [
        estateId ? `Objekt ${zeile.onoffice_estate_no ?? estateId}` : null,
        addressId ? `Kunde ${zeile.onoffice_address_no ?? addressId}` : null,
      ]
        .filter(Boolean)
        .join(" und ") + " verknüpft – hier und in onOffice.",
      ...meldungen,
    ].join(" "),
  });
}
