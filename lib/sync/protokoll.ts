/**
 * Eine Stelle fuers Protokoll - und drei Regeln, die es klein halten.
 *
 * Gemessen am 05.10.2026: onoffice_sync_log war 23 MB bei 38.000
 * Zeilen und wuchs um 1,6 MB am Tag. Davon:
 *
 *   6,6 MB  4.832x "Tag-Filter angenommen - 0x gesetzt"
 *   1,5 MB  1.686x derselbe Dateifehler
 *   1,5 MB ~10.000x "84 gelesen, 0 uebernommen (0 neu, 0 aktualisiert)"
 *
 * Nichts davon ist Geschichte. Es ist dieselbe Aussage, 700 Mal am
 * Tag: es ist nichts passiert. Die drei Regeln:
 *
 *   1. Ein Lauf ohne Ergebnis bekommt keine Zeile, sondern
 *      aktualisiert EINE Zeile "letzter Lauf". Dass der Abgleich
 *      laeuft, bleibt sichtbar - nur eben einmal statt 720 Mal.
 *   2. Dieselbe Meldung zur selben Sache zaehlt hoch, statt sich zu
 *      vermehren. Aus 1.686 Zeilen wird "1686x, zuletzt ...".
 *   3. payload nur im Fehlerfall. Bei Erfolg sagt der Satz alles, und
 *      das Rohobjekt sind 1,3 kB Ballast.
 *
 * Gegen das Protokollieren spricht nichts - gegen das Protokollieren
 * von Nichts schon.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface ProtokollEintrag {
  direction: "pull" | "push";
  resource: string;
  reference?: string | null;
  ok: boolean;
  message: string;
  payload?: unknown;
  /**
   * Hat dieser Lauf etwas bewirkt?
   *
   * false heisst: gelaufen, nichts getan. Solche Laeufe teilen sich
   * EINE Zeile je Ressource, die immer wieder ueberschrieben wird.
   * Ohne Angabe gilt true - ein Aufrufer, der nichts sagt, hat
   * vermutlich etwas zu sagen.
   */
  relevant?: boolean;
}

/** Wie lange eine Wiederholung noch als dieselbe Sache zaehlt. */
const ZUSAMMENFASSEN_STUNDEN = 24;

export async function protokolliere(e: ProtokollEintrag): Promise<void> {
  try {
    const sb = supabaseAdmin();
    const jetzt = new Date().toISOString();

    // payload nur, wenn etwas schiefging. Das war der groesste
    // Einzelposten: ein vollstaendiges Ergebnisobjekt je Lauf.
    const payload = e.ok ? null : (e.payload ?? null);

    /**
     * Der folgenlose Lauf.
     *
     * Eine feste Referenz je Ressource, und die Zeile wird
     * ueberschrieben statt vermehrt. Wer wissen will, ob der Abgleich
     * laeuft, sieht den Zeitstempel - und wie oft er seither nichts
     * zu tun hatte.
     */
    if (e.ok && e.relevant === false) {
      const referenz = `ruhig:${e.resource}`;
      const { data: vorhanden } = await sb
        .from("onoffice_sync_log")
        .select("id, anzahl")
        .eq("resource", e.resource)
        .eq("reference", referenz)
        .maybeSingle();

      if (vorhanden) {
        await sb
          .from("onoffice_sync_log")
          .update({
            message: e.message,
            anzahl: (vorhanden.anzahl ?? 1) + 1,
            zuletzt_at: jetzt,
          })
          .eq("id", vorhanden.id);
        return;
      }

      await sb.from("onoffice_sync_log").insert({
        direction: e.direction,
        resource: e.resource,
        reference: referenz,
        ok: true,
        message: e.message,
        payload: null,
        anzahl: 1,
        zuletzt_at: jetzt,
      });
      return;
    }

    /**
     * Die Wiederholung.
     *
     * Gleiche Ressource, gleiche Referenz, gleiche Meldung, und das
     * innerhalb eines Tages: dann ist es dasselbe Vorkommnis und
     * nicht das naechste. Der Zaehler steigt, der Zeitstempel des
     * ersten Auftretens bleibt - sonst wuesste man nicht mehr, seit
     * wann es klemmt, und genau das ist die interessante Zahl.
     */
    const { data: letzte } = await sb
      .from("onoffice_sync_log")
      .select("id, message, anzahl")
      .eq("resource", e.resource)
      .eq("reference", e.reference ?? "")
      .gte("created_at", new Date(Date.now() - ZUSAMMENFASSEN_STUNDEN * 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (letzte && letzte.message === e.message) {
      await sb
        .from("onoffice_sync_log")
        .update({ anzahl: (letzte.anzahl ?? 1) + 1, zuletzt_at: jetzt })
        .eq("id", letzte.id);
      return;
    }

    await sb.from("onoffice_sync_log").insert({
      direction: e.direction,
      resource: e.resource,
      reference: e.reference ?? null,
      ok: e.ok,
      message: e.message,
      payload,
    });
  } catch {
    /* Das Protokoll ist Beiwerk. Daran soll kein Lauf scheitern. */
  }
}
