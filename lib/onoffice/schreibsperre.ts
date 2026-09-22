/**
 * Die Sperre vor jedem Schreibvorgang nach onOffice.
 *
 * app_settings.sync_read_only stand von Anfang an in der Datenbank, wurde
 * im Adminbereich angezeigt - und von keiner Zeile Code gelesen. Ein
 * Schalter mit der Aufschrift "es wird nichts zurueckgeschrieben", der
 * nichts schaltet, ist schlimmer als keiner: man verlaesst sich auf ihn,
 * und zwar genau einmal.
 *
 * Deshalb liegt die Pruefung hier, in einer Datei, und jeder Schreibweg
 * geht durch sie hindurch. Nicht in drei Kopien in drei Routen, wo eine
 * beim naechsten Umbau vergessen wird.
 *
 * Zwei Stufen:
 *  - sync_read_only  = true   sperrt ALLES. Der Hauptschalter.
 *  - sync_push_*              sperrt einzelne Anlaesse.
 *
 * Verweigert wird im Zweifel: kann die Einstellung nicht gelesen werden,
 * gilt gesperrt. Beim Schreiben in fremde Daten ist das die richtige
 * Richtung fuer eine Unsicherheit.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { onofficeConfigured } from "@/lib/onoffice/client";

export type Anlass = "bearbeiter" | "status";

const SCHALTER: Record<Anlass, string> = {
  bearbeiter: "sync_push_assignee",
  status: "sync_push_status",
};

export interface Sperre {
  /** Darf geschrieben werden? */
  erlaubt: boolean;
  /** Was dem Menschen gesagt wird, wenn nicht. */
  grund?: string;
}

export async function pruefeSchreibsperre(anlass: Anlass): Promise<Sperre> {
  if (!onofficeConfigured()) {
    return { erlaubt: false, grund: "Die onOffice-Zugangsdaten sind nicht gesetzt." };
  }

  const sb = supabaseAdmin();
  // Beide Schalter fest angefragt statt den Namen einzusetzen: eine
  // zusammengesetzte Spaltenliste kann der getypte Client nicht lesen,
  // und eine Abfrage, die der Compiler nicht versteht, ist an dieser
  // Stelle keine gute Idee.
  const { data, error } = await sb
    .from("app_settings")
    .select("sync_read_only, sync_push_assignee, sync_push_status")
    .maybeSingle();

  if (error || !data) {
    return {
      erlaubt: false,
      grund:
        "Die Einstellungen sind gerade nicht lesbar. Solange das so ist, " +
        "wird nach onOffice nichts geschrieben.",
    };
  }

  const werte = data as Record<string, unknown>;

  if (werte.sync_read_only !== false) {
    return {
      erlaubt: false,
      grund:
        "Das Zurückschreiben nach onOffice ist abgeschaltet (Einstellungen, " +
        "„nur lesen“). Im Tool ist die Änderung gespeichert.",
    };
  }

  if (werte[SCHALTER[anlass]] === false) {
    return {
      erlaubt: false,
      grund:
        anlass === "status"
          ? "Statuswechsel werden derzeit nicht nach onOffice übertragen."
          : "Das Eintragen des Bearbeiters ist derzeit abgeschaltet.",
    };
  }

  return { erlaubt: true };
}
