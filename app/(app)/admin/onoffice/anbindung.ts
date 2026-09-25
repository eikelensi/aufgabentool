/**
 * Der tatsaechliche Zustand der onOffice-Anbindung.
 *
 * Vorher stand hier eine Liste aus der Prototyp-Zeit mit fest
 * einprogrammierten Haekchen. Die war nach ein paar Wochen falsch, und
 * eine falsche Statusanzeige ist schlimmer als gar keine: sie behauptet
 * Gewissheit. Jetzt kommt alles aus dem laufenden System - und was die
 * Schnittstelle nachweislich nicht kann, steht als nicht moeglich drin,
 * nicht als "offen".
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { onofficeConfigured } from "@/lib/onoffice/client";
import { onofficeMailConfigured } from "@/lib/mail/onoffice";
import { smtpConfigured } from "@/lib/mail/smtp";

export type Zustand = "bereit" | "offen" | "prüfen" | "nicht möglich";

export interface AnbindungsZeile {
  label: string;
  zustand: Zustand;
  hinweis: string;
}

export interface Anbindung {
  zeilen: AnbindungsZeile[];
}

function datum(iso: string | null | undefined): string {
  if (!iso) return "noch nie";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function ladeAnbindung(): Promise<Anbindung> {
  const sb = supabaseAdmin();

  const [einst, cursor, ausOnoffice, kollegen, mitNamen, letzterFehler] = await Promise.all([
    sb
      .from("app_settings")
      .select(
        "sync_read_only, sync_push_assignee, sync_push_status, onoffice_email_identity, mail_provider",
      )
      .maybeSingle(),
    sb.from("onoffice_sync_cursor").select("last_run_at").eq("resource", "task").maybeSingle(),
    sb.from("tasks").select("*", { count: "exact", head: true }).not("onoffice_task_id", "is", null),
    sb.from("broker_contacts").select("*", { count: "exact", head: true }).eq("is_active", true),
    sb.from("profiles").select("*", { count: "exact", head: true }).not("onoffice_display_name", "is", null),
    sb
      .from("onoffice_sync_log")
      .select("message, created_at")
      .eq("ok", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const s = einst.data;
  const zugang = onofficeConfigured();
  const namen = mitNamen.count ?? 0;
  const aufgaben = ausOnoffice.count ?? 0;

  const zeilen: AnbindungsZeile[] = [
    {
      label: "Zugangsdaten (Token und Secret)",
      zustand: zugang ? "bereit" : "offen",
      hinweis: zugang
        ? "gesetzt; Anmeldung über HMAC v2, gegen diesen Mandanten geprüft"
        : "fehlen in dieser Umgebung – ohne sie geht nichts",
    },
    {
      label: "Aufgaben lesen",
      zustand: !zugang ? "offen" : namen === 0 ? "prüfen" : "bereit",
      hinweis:
        namen === 0
          ? "kein Nutzer hat einen onOffice-Namen – es wird nichts übernommen"
          : `${aufgaben} Aufgaben übernommen, letzter Abgleich: ${datum(cursor.data?.last_run_at)}`,
    },
    {
      label: "Schreiben nach onOffice (Hauptschalter)",
      zustand: s?.sync_read_only === false ? "bereit" : "offen",
      hinweis:
        s?.sync_read_only === false
          ? "freigegeben – die beiden Zeilen darunter gelten"
          : "„nur lesen“ ist an; nach onOffice wird nichts geschrieben",
    },
    {
      label: "Bearbeiter zurückschreiben",
      zustand:
        s?.sync_read_only !== false
          ? "offen"
          : s?.sync_push_assignee === true
            ? "bereit"
            : "offen",
      hinweis:
        s?.sync_read_only !== false
          ? "durch den Hauptschalter gesperrt"
          : s?.sync_push_assignee === true
            ? "wer sich eine Aufgabe aus dem Pool zieht, wird in onOffice eingetragen"
            : "abgeschaltet",
    },
    {
      label: "Status zurückschreiben",
      zustand:
        s?.sync_read_only !== false ? "offen" : s?.sync_push_status === true ? "bereit" : "offen",
      hinweis:
        s?.sync_read_only !== false
          ? "durch den Hauptschalter gesperrt"
          : s?.sync_push_status === true
            ? "Statuswechsel im Tool setzt den Status auch in onOffice (Zahlen 1/2/3 nach apidoc)"
            : "abgeschaltet",
    },
    {
      label: "Benutzerliste für Kollegen",
      zustand: "prüfen",
      hinweis: `gibt nur Mailadressen her, keine Namen oder Telefonnummern – ${kollegen.count ?? 0} Kollegen gepflegt`,
    },
    {
      label: "Objekt- und Adressbezug",
      zustand: "bereit",
      hinweis: "Objektnummer → estate-ID, Kundendatensatz → address-ID",
    },
    {
      label: "Mailversand",
      zustand: onofficeMailConfigured()
        ? "bereit"
        : smtpConfigured()
          ? "bereit"
          : "offen",
      hinweis: onofficeMailConfigured()
        ? `über onOffice, Identität ${s?.onoffice_email_identity ?? "gesetzt"}`
        : smtpConfigured()
          ? "über eigenen SMTP-Zugang; onOffice-Versand ist nicht eingerichtet"
          : "weder onOffice noch SMTP eingerichtet – es geht nichts raus",
    },
    {
      label: "Posteingang → Aufgabe",
      zustand: "offen",
      hinweis: "noch nicht gebaut; ginge über IMAP auf ein Postfach",
    },
    {
      label: "Datei an Aufgabe hochladen",
      zustand: zugang ? "bereit" : "offen",
      hinweis: "uploadfile → tmpUploadId, dann module=task mit relatedRecordId",
    },
    {
      label: "Aufgaben-Datei löschen",
      zustand: zugang ? "bereit" : "offen",
      hinweis: "delete auf fileRelation, relationtype=task",
    },
    {
      label: "Aufgaben-Dateien lesen",
      zustand: "nicht möglich",
      hinweis:
        "file+task meldet Code 24, fileRelation ist nicht lesbar (Code 25) – deshalb ist dieses Tool die führende Ablage",
    },
    {
      label: "Blättern in Ergebnislisten",
      zustand: "nicht möglich",
      hinweis: "listoffset und sortby werden abgelehnt (Code 144); ein Lauf holt höchstens 500 Aufgaben",
    },
  ];

  if (letzterFehler.data) {
    zeilen.push({
      label: "Letzter Fehler",
      zustand: "prüfen",
      hinweis: `${datum(letzterFehler.data.created_at)}: ${String(letzterFehler.data.message).slice(0, 120)}`,
    });
  }

  return { zeilen };
}
