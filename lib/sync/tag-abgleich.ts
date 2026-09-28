/**
 * "Auftrag von" fuellen, ohne das Feld "tags" zu lesen.
 *
 * Der Stand der Messung: der Lesecall auf die Aufgabe lehnt "tags" ab
 * (Code 144). Daraus habe ich geschlossen, das Feld sei fuer die
 * Schnittstelle zu - und dabei uebersehen, dass LESEN und FILTERN zwei
 * verschiedene Wege durch dieselbe Schnittstelle sind. Schreiben geht
 * ja auch: createTask schickt "tags" seit jeher mit.
 *
 * Also die Frage umdrehen. Nicht "welches Tag traegt diese Aufgabe" -
 * sondern, je Tag einmal, "welche Aufgaben tragen dich?". Das sind drei
 * Aufrufe fuer den ganzen Bestand, unabhaengig davon, wie viele
 * Aufgaben es gibt, und es braucht keine Freischaltung durch onOffice.
 *
 * Wenn onOffice auch den Filter ablehnt, ist das kein Fehler, sondern
 * eine Antwort: sie steht im Protokoll, und der Abgleich laeuft
 * unveraendert weiter.
 */
import { tryCall, elements, type OnOfficeRecord } from "@/lib/onoffice/client";
import { TAGS_FELD } from "@/lib/onoffice/mapping";
import { readTaskFields } from "@/lib/onoffice/tasks";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface TagAbgleichErgebnis {
  /** Hat onOffice den Filter ueberhaupt angenommen? */
  moeglich: boolean;
  /** Wie viele Aufgaben einen Auftraggeber bekommen haben. */
  zugeordnet: number;
  /** Je Tag: wie viele Aufgaben onOffice dazu genannt hat. */
  jeTag: Record<string, number>;
  hinweise: string[];
}

function normalisiere(name: string | null | undefined): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-zäöüß]/g, "")
    .trim();
}

/**
 * Je erlaubtem Tag-Wert einmal fragen, welche Aufgaben ihn tragen.
 *
 * Probiert erst den internen Schluessel ("indMulti3818Select6324"),
 * dann die Beschriftung ("Lensinger"). Welcher von beiden gilt, sagt
 * die Doku nicht eindeutig, und Ausprobieren kostet hier einen Aufruf.
 */
async function aufgabenMitTag(
  schluessel: string,
  beschriftung: string,
): Promise<{ ok: true; nummern: string[]; ueber: string } | { ok: false; meldung: string }> {
  let letzteMeldung = "";

  for (const [wert, wie] of [
    [schluessel, "Schlüssel"],
    [beschriftung, "Beschriftung"],
  ]) {
    if (!wert) continue;
    const res = await tryCall({
      action: "read",
      resourceType: "task",
      parameters: {
        data: ["Nr"],
        filter: { [TAGS_FELD]: [{ op: "=", val: wert }] },
        listlimit: 500,
      },
    });

    if (!res.ok) {
      letzteMeldung = res.error.message;
      continue;
    }

    const nummern = (res.result.records as OnOfficeRecord[])
      .map((r) => String(elements(r).Nr ?? r.id ?? ""))
      .filter(Boolean);
    return { ok: true, nummern, ueber: wie };
  }

  return { ok: false, meldung: letzteMeldung || "Kein Weg hat geantwortet." };
}

export async function ordneAuftragUeberTagFilter(): Promise<TagAbgleichErgebnis> {
  const ergebnis: TagAbgleichErgebnis = {
    moeglich: false,
    zugeordnet: 0,
    jeTag: {},
    hinweise: [],
  };

  // Die erlaubten Werte kommen aus der Feldkonfiguration - die liest
  // sich nachweislich, samt Schluessel und Beschriftung.
  let werte: Record<string, string> = {};
  try {
    const felder = await readTaskFields();
    werte = felder.find((f) => f.name === TAGS_FELD)?.wertLabels ?? {};
  } catch (err) {
    ergebnis.hinweise.push(`Feldkonfiguration nicht lesbar: ${(err as Error).message}`);
    return ergebnis;
  }

  if (!Object.keys(werte).length) {
    ergebnis.hinweise.push(`In onOffice sind für „${TAGS_FELD}“ keine Werte hinterlegt.`);
    return ergebnis;
  }

  const sb = supabaseAdmin();

  // Dieselbe Rangfolge wie ueberall: gepflegtes Tag, dann Kuerzel,
  // dann Nachname. Und mehrdeutig heisst weiterhin: gar nicht.
  const { data: kollegen } = await sb
    .from("broker_contacts")
    .select("id, display_name, short_code, onoffice_tag")
    .eq("is_active", true);

  const nachTag = new Map<string, string | null>();
  const eintragen = (wert: string | null | undefined, id: string, festgelegt: boolean) => {
    const key = normalisiere(wert);
    if (!key) return;
    const vorhanden = nachTag.get(key);
    if (vorhanden === undefined) return void nachTag.set(key, id);
    if (vorhanden !== id) nachTag.set(key, festgelegt && !vorhanden ? id : null);
  };
  for (const k of kollegen ?? []) eintragen(k.onoffice_tag, k.id, true);
  for (const k of kollegen ?? []) eintragen(k.short_code, k.id, false);
  for (const k of kollegen ?? []) eintragen(String(k.display_name ?? "").split(",")[0], k.id, false);

  for (const [schluessel, beschriftung] of Object.entries(werte)) {
    const brokerId = nachTag.get(normalisiere(beschriftung));

    if (!brokerId) {
      // Kein Kollege oder zwei - beides ein Fall fuer einen Menschen.
      // Fragen braucht man dann gar nicht erst.
      ergebnis.hinweise.push(
        brokerId === null
          ? `Das Tag „${beschriftung}“ passt auf mehrere Kollegen – nicht zugeordnet.`
          : `Zum Tag „${beschriftung}“ gibt es keinen Kollegen mit diesem onOffice-Tag.`,
      );
      continue;
    }

    const treffer = await aufgabenMitTag(schluessel, beschriftung);
    if (!treffer.ok) {
      ergebnis.hinweise.push(`„${beschriftung}“: ${treffer.meldung}`);
      continue;
    }

    ergebnis.moeglich = true;
    ergebnis.jeTag[beschriftung] = treffer.nummern.length;
    if (!treffer.nummern.length) continue;

    // Nur setzen, wo noch nichts steht oder etwas anderes steht.
    // onOffice fuehrt bei diesem Feld - aber ein unnoetiges UPDATE
    // ist eine Zeile im Protokoll und ein Realtime-Ereignis fuer
    // jeden offenen Browser. Davon hatten wir genug.
    const { data: betroffen } = await sb
      .from("tasks")
      .select("id, broker_contact_id")
      .in("onoffice_task_id", treffer.nummern);

    const zuAendern = (betroffen ?? [])
      .filter((t) => t.broker_contact_id !== brokerId)
      .map((t) => t.id);

    if (!zuAendern.length) continue;

    const { error } = await sb
      .from("tasks")
      .update({
        broker_contact_id: brokerId,
        onoffice_tag: beschriftung,
        updated_at: new Date().toISOString(),
      })
      .in("id", zuAendern);

    if (error) {
      ergebnis.hinweise.push(`„${beschriftung}“: ${error.message}`);
      continue;
    }
    ergebnis.zugeordnet += zuAendern.length;
    ergebnis.hinweise.push(
      `„${beschriftung}“: ${zuAendern.length}× „Auftrag von“ gesetzt (über ${treffer.ueber}).`,
    );
  }

  if (!ergebnis.moeglich && !ergebnis.hinweise.length) {
    ergebnis.hinweise.push("onOffice nimmt den Filter auf das Tag nicht an.");
  }

  return ergebnis;
}
