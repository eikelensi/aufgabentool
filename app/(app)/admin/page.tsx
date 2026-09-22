/**
 * Adminbereich, Uebersicht: der Zustand des Systems auf einen Blick, mit
 * Wegweisern in die Unterbereiche. Bewusst keine Bedienelemente - hier
 * wird nichts geaendert, nur gezeigt, wo etwas fehlt.
 */
import Link from "next/link";
import { supabaseAdmin, serviceRoleVorhanden } from "@/lib/supabase/admin";
import { onofficeConfigured } from "@/lib/onoffice/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Verwaltung – Aufgabentool" };

function Kachel({
  href,
  titel,
  zahl,
  text,
  warnung,
}: {
  href: string;
  titel: string;
  zahl?: string;
  text: string;
  warnung?: string;
}) {
  return (
    <Link href={href} className="panel block p-4 transition hover:border-[color:var(--color-ci-400)]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{titel}</h2>
        {zahl ? <span className="text-lg font-semibold">{zahl}</span> : null}
      </div>
      <p className="muted mt-1 text-[11px] leading-relaxed">{text}</p>
      {warnung ? (
        <p
          className="mt-2 rounded px-2 py-1 text-[11px] leading-relaxed"
          style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}
        >
          {warnung}
        </p>
      ) : null}
    </Link>
  );
}

export default async function AdminUebersicht() {
  if (!serviceRoleVorhanden()) {
    return (
      <div className="panel p-4" style={{ maxWidth: 560 }}>
        <p className="muted text-xs leading-relaxed">
          Es fehlt der <code>SUPABASE_SERVICE_ROLE_KEY</code>. Ohne ihn bleibt die
          Verwaltung leer.
        </p>
      </div>
    );
  }

  const sb = supabaseAdmin();
  const zaehle = async (tabelle: string, filter?: (q: never) => never) => {
    const { count } = await sb.from(tabelle).select("*", { count: "exact", head: true });
    return count ?? 0;
  };

  const [nutzer, kollegen, aufgaben, kategorien, mails, eintraege, ohneName, ohneTelefon, cursor] =
    await Promise.all([
      zaehle("profiles"),
      zaehle("broker_contacts"),
      zaehle("tasks"),
      zaehle("categories"),
      zaehle("notifications_log"),
      zaehle("audit_log"),
      sb
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .is("onoffice_display_name", null)
        .eq("is_active", true),
      sb
        .from("broker_contacts")
        .select("*", { count: "exact", head: true })
        .is("phone", null)
        .eq("is_active", true),
      sb.from("onoffice_sync_cursor").select("last_run_at").eq("resource", "task").maybeSingle(),
    ]);

  const fehlendeNamen = ohneName.count ?? 0;
  const fehlendeTelefone = ohneTelefon.count ?? 0;
  const letzterLauf = cursor.data?.last_run_at
    ? new Date(cursor.data.last_run_at).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kachel
          href="/admin/nutzer"
          titel="Nutzerverwaltung"
          zahl={String(nutzer)}
          text="Wer sich anmelden darf. Einladen, Rollen vergeben, sperren, Passwort zurücksetzen."
          warnung={
            fehlendeNamen
              ? `Bei ${fehlendeNamen} ${fehlendeNamen === 1 ? "Person fehlt" : "Personen fehlt"} der onOffice-Name – für sie kommen keine Aufgaben.`
              : undefined
          }
        />
        <Kachel
          href="/admin/kollegen"
          titel="Mitarbeiterverwaltung"
          zahl={String(kollegen)}
          text="Die zuordenbaren Kollegen mit Telefon, Durchwahl und Standort. Kein Zugang nötig."
          warnung={
            fehlendeTelefone
              ? `${fehlendeTelefone} ohne Telefonnummer.`
              : undefined
          }
        />
        <Kachel
          href="/admin/einstellungen"
          titel="Einstellungen"
          zahl={String(kategorien)}
          text="Kategorien und Farben, Fristen für Erinnerung und Eskalation, Mailweg und Mailvorlagen."
        />
        <Kachel
          href="/admin/darstellung"
          titel="Darstellung"
          text="Die Farben des dunklen Modus – gelten für alle, mit Prüfung auf Lesbarkeit."
        />
        <Kachel
          href="/admin/protokoll"
          titel="Protokolle"
          zahl={String(eintraege)}
          text={`Wer was geändert hat, und jede verschickte Mail (${mails}). Wird still mitgeschrieben.`}
        />
        <Kachel
          href="/admin/handbuch"
          titel="Handbuch"
          text="Die Anleitung zum Tool – erzeugt aus den Einstellungen, die gerade wirklich gelten."
        />
        <Kachel
          href="/admin/onoffice"
          titel="onOffice"
          zahl={String(aufgaben)}
          text={
            letzterLauf
              ? `Aufgaben im Tool. Letzter Abgleich: ${letzterLauf}.`
              : "Aufgaben im Tool. Es lief noch kein Abgleich."
          }
          warnung={
            onofficeConfigured() ? undefined : "Die onOffice-Zugangsdaten sind nicht gesetzt."
          }
        />
      </div>
    </div>
  );
}
