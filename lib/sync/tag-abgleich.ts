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
import { protokolliere } from "./protokoll";

export interface TagAbgleichErgebnis {
  /** Hat onOffice den Filter ueberhaupt angenommen? */
  moeglich: boolean;
  /** Wie viele Aufgaben einen Auftraggeber bekommen haben. */
  zugeordnet: number;
  /** Je Tag: wie viele Aufgaben onOffice dazu genannt hat. */
  jeTag: Record<string, number>;
  /**
   * Kollegen, fuer die es in onOffice GAR KEIN Tag gibt.
   *
   * Der Abgleich kann fuer sie nichts finden - nicht weil etwas kaputt
   * waere, sondern weil es den Wert drueben nicht gibt. Ohne diese
   * Liste sieht das aus wie ein Fehler des Tools.
   */
  ohneTagInOnoffice: string[];
  /** Was onOffice als erlaubte Werte fuehrt. */
  tagsInOnoffice: string[];
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
  const PRO_SEITE = 500;
  // Reissleine: lieber eine Seite zu wenig als eine Endlosschleife,
  // wenn onOffice den Offset ignoriert und immer dasselbe liefert.
  const MAX_SEITEN = 20;

  for (const [wert, wie] of [
    [schluessel, "Schlüssel"],
    [beschriftung, "Beschriftung"],
  ]) {
    if (!wert) continue;

    const nummern: string[] = [];
    const gesehen = new Set<string>();
    let offset = 0;
    let abgelehnt = false;
    let mehrAlsEineSeite = false;

    for (let seite = 0; seite < MAX_SEITEN; seite++) {
      /**
       * "listoffset" kennt die task-Ressource NICHT.
       *
       * Die Paginierung, die ich vorsorglich eingebaut habe, hat den
       * Weg zerstoert, den sie absichern sollte: onOffice antwortete
       * jedem Lauf mit Invalid field in input data: "listoffset"
       * (Code 144). Die Probe - ohne listoffset - lief zur selben
       * Zeit sauber durch. Vorsorge, die den Normalfall bricht, ist
       * keine Vorsorge.
       *
       * Also: die erste Seite immer ohne. Nur wenn sie randvoll ist,
       * ueberhaupt eine zweite versuchen - und wenn onOffice die
       * ablehnt, hoert es hier auf, mit einem Hinweis statt einem
       * Fehlschlag.
       */
      const parameters: Record<string, unknown> = {
        // KEIN "Nr" im data-Block - das ist ein Filterfeld, und der
        // Versuch wurde deshalb abgelehnt, ohne dass das etwas ueber
        // "tags" ausgesagt haette. Die Nummer kommt als Satzkennung.
        data: ["Betreff"],
        filter: { [TAGS_FELD]: [{ op: "=", val: wert }] },
        listlimit: PRO_SEITE,
      };
      if (offset > 0) parameters.listoffset = offset;

      const res = await tryCall({ action: "read", resourceType: "task", parameters });

      if (!res.ok) {
        // Auf der ZWEITEN Seite ist eine Ablehnung kein Grund,
        // alles zu verwerfen: die erste Seite ist echt. Lieber
        // unvollstaendig und ehrlich als gar nichts.
        if (offset > 0) {
          mehrAlsEineSeite = true;
          break;
        }
        letzteMeldung = res.error.message;
        abgelehnt = true;
        break;
      }

      const saetze = res.result.records as OnOfficeRecord[];
      let neueDabei = false;
      for (const r of saetze) {
        const nr = String(elements(r).Nr ?? r.id ?? "");
        if (!nr || gesehen.has(nr)) continue;
        gesehen.add(nr);
        nummern.push(nr);
        neueDabei = true;
      }

      // Weniger als eine volle Seite heisst: das war die letzte.
      // Nichts Neues heisst: der Offset wird ignoriert - dann hoert
      // man besser auf, statt dieselbe Seite zwanzigmal zu holen.
      if (saetze.length < PRO_SEITE || !neueDabei) break;
      offset += PRO_SEITE;
    }

    if (abgelehnt) continue;
    return {
      ok: true,
      nummern,
      ueber: mehrAlsEineSeite ? `${wie}, nur erste ${PRO_SEITE}` : wie,
    };
  }

  return { ok: false, meldung: letzteMeldung || "Kein Weg hat geantwortet." };
}

export async function ordneAuftragUeberTagFilter(): Promise<TagAbgleichErgebnis> {
  const ergebnis: TagAbgleichErgebnis = {
    moeglich: false,
    zugeordnet: 0,
    jeTag: {},
    ohneTagInOnoffice: [],
    tagsInOnoffice: [],
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

  ergebnis.tagsInOnoffice = Object.values(werte);

  // Die Gegenrichtung, und der haeufigere Fall: ein Kollege, den
  // onOffice als Tag gar nicht kennt. Fuer ihn kann hier nie etwas
  // ankommen - das ist kein Fehler, sondern eine Luecke in onOffice,
  // und sie gehoert sichtbar gemacht statt stillschweigend ertragen.
  const bekannt = new Set(Object.values(werte).map((v) => normalisiere(v)));
  for (const k of kollegen ?? []) {
    const tag =
      k.onoffice_tag?.trim() ||
      String(k.display_name ?? "").split(",")[0].trim() ||
      k.short_code?.trim() ||
      "";
    if (!tag || bekannt.has(normalisiere(tag))) continue;
    ergebnis.ohneTagInOnoffice.push(`${k.display_name ?? tag} (Tag „${tag}“)`);
  }
  ergebnis.ohneTagInOnoffice.sort();

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

  /**
   * Ins Protokoll, und zwar bei JEDEM Lauf.
   *
   * Sonst muss jemand einen Knopf in der Verwaltung druecken, um zu
   * erfahren, ob der Weg traegt - und bis dahin sieht man nur, dass
   * "Auftrag von" leer bleibt, ohne zu wissen, woran es liegt. Genau
   * diese Blindheit hat heute Stunden gekostet.
   */
  /**
   * Ins Protokoll - aber nicht 720 Mal am Tag dasselbe.
   *
   * Diese Zeile habe ich am 28.09. eingebaut, damit sichtbar wird, ob
   * der Filterweg traegt. Sie hat in einer Woche 6,6 MB geschrieben,
   * 4.832 Mal denselben Satz, und das ganze Ergebnisobjekt gleich
   * mit. Gemeint war Sichtbarkeit, geworden ist es Rauschen.
   *
   * Jetzt: ein Lauf, der nichts zugeordnet hat, ist nicht relevant -
   * er aktualisiert die eine "ruhig"-Zeile. Sobald etwas passiert
   * oder der Filter abgelehnt wird, steht es wieder einzeln da.
   */
  await protokolliere({
    direction: "pull",
    resource: "tag-filter",
    reference: "tag-filter",
    ok: ergebnis.moeglich,
    relevant: !ergebnis.moeglich || ergebnis.zugeordnet > 0,
    message: ergebnis.moeglich
      ? `Tag-Filter angenommen · ${ergebnis.zugeordnet}× „Auftrag von“ gesetzt · ` +
        (Object.entries(ergebnis.jeTag)
          .map(([t, n]) => `${t}: ${n}`)
          .join(", ") || "keine Treffer") +
        ` · ${ergebnis.ohneTagInOnoffice.length} Kollegen ohne Tag in onOffice`
      : `Tag-Filter abgelehnt · ${ergebnis.hinweise.join(" | ").slice(0, 400)}`,
    payload: ergebnis,
  });

  return ergebnis;
}
