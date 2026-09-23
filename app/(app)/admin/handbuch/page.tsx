/**
 * Handbuch - erzeugt, nicht gepflegt.
 *
 * Der Text beschreibt die Regeln, die fest im Tool stecken; alle Zahlen,
 * Listen und Fristen kommen bei jedem Aufruf frisch aus der Datenbank.
 * Damit kann das Handbuch nicht veralten: wer eine Kategorie anlegt oder
 * eine Frist aendert, aendert damit auch diese Seite.
 */
import { supabaseAdmin, serviceRoleVorhanden } from "@/lib/supabase/admin";
import { onofficeConfigured } from "@/lib/onoffice/client";
import { STATUS_LABEL } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Handbuch – Aufgabentool" };

const ROLLE_TEXT: Record<string, string> = {
  superadmin: "sieht und darf alles, auch die Einstellungen – immer, unabhängig von jeder Einstellung",
  gf: "sieht alle Aufgaben, darf umverteilen und verwalten, dazu den Asana-Bereich",
  qm: "sieht alle Aufgaben und die Übersicht",
  user: "sieht die eigenen Aufgaben und den Pool",
};

function Abschnitt({
  nummer,
  titel,
  children,
}: {
  nummer: number;
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel mb-3 p-4">
      <h2 className="mb-2 text-sm font-semibold">
        <span className="muted mr-1.5 font-normal">{nummer}.</span>
        {titel}
      </h2>
      <div className="space-y-2 text-xs leading-relaxed">{children}</div>
    </section>
  );
}

export default async function HandbuchSeite() {
  if (!serviceRoleVorhanden()) {
    return (
      <div className="panel p-4" style={{ maxWidth: 560 }}>
        <p className="muted text-xs">Es fehlt der Service-Role-Schlüssel.</p>
      </div>
    );
  }

  const sb = supabaseAdmin();

  const [einst, kategorien, nutzer, kollegen, vorlagen, cursor, arten] = await Promise.all([
    sb.from("app_settings").select("*").maybeSingle(),
    sb.from("categories").select("name, color, is_active").order("sort_order"),
    sb
      .from("profiles")
      .select("full_name, role, is_active, onoffice_display_name")
      .order("role")
      .order("full_name"),
    sb.from("broker_contacts").select("display_name, email, is_active").order("display_name"),
    sb.from("email_templates").select("key, label, is_active"),
    sb.from("onoffice_sync_cursor").select("last_run_at").eq("resource", "task").maybeSingle(),
    sb.from("task_types").select("label").eq("is_active", true).order("sort_order"),
  ]);

  const s = einst.data;
  const erinnerung = s?.reminder_days ?? 3;
  const eskalation = s?.escalation_days ?? 7;
  const ausblenden = s?.done_hide_after_hours ?? 24;
  const maxMb = s?.attachment_max_mb ?? 25;
  const weg = s?.mail_provider ?? "onoffice";
  const nurLesen = s?.sync_read_only ?? true;

  const aktiveNutzer = (nutzer.data ?? []).filter((n) => n.is_active);
  const mitOnoffice = aktiveNutzer.filter((n) => n.onoffice_display_name);
  const aktiveKollegen = (kollegen.data ?? []).filter((k) => k.is_active);
  const aktiveKategorien = (kategorien.data ?? []).filter((k) => k.is_active);
  const aktiveVorlagen = (vorlagen.data ?? []).filter((v) => v.is_active);

  const stand = new Date().toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="max-w-[80ch]">
      <p className="muted mb-4 text-xs leading-relaxed">
        Diese Anleitung wird nicht von Hand gepflegt. Die Regeln stehen fest, alle
        Zahlen und Listen kommen bei jedem Aufruf frisch aus dem System – wer eine
        Kategorie anlegt oder eine Frist ändert, ändert damit auch diese Seite.
        <br />
        <strong>Stand: {stand}</strong>
      </p>

      <Abschnitt nummer={1} titel="Wer sieht was">
        <p>
          Mitarbeitende sehen ihre eigenen Aufgaben und alles, was unbesetzt im
          Pool liegt. Admins sehen alles. Private Aufgaben sieht ausschließlich,
          wer sie angelegt hat – auch ein Superadmin nicht.
        </p>
        <p className="muted">
          Das ist keine Höflichkeitsregel der Oberfläche, sondern in der Datenbank
          festgelegt. Wer eine Aufgabe nicht sehen darf, bekommt sie auch dann
          nicht, wenn er die Adresse direkt aufruft.
        </p>
        <ul className="mt-2 space-y-1">
          {aktiveNutzer.map((n) => (
            <li key={n.full_name}>
              <strong>{n.full_name}</strong> – {ROLLE_TEXT[n.role] ?? n.role}
            </li>
          ))}
        </ul>
        {aktiveNutzer.length === 0 ? (
          <p className="muted">Noch keine aktiven Zugänge.</p>
        ) : null}
      </Abschnitt>

      <Abschnitt nummer={2} titel="Der Weg einer Aufgabe">
        <p>
          Es gibt genau drei Status:{" "}
          <strong>{Object.values(STATUS_LABEL).join(" → ")}</strong>. Mehr nicht,
          und das ist Absicht.
        </p>
        <p>
          Beim Wechsel auf <strong>Rückfragen offen</strong> ist eine Notiz
          Pflicht. Ohne Notiz lässt sich dieser Status nicht speichern – die
          Datenbank weist ihn ab. Die Notiz geht an die Verantwortung und an den
          zugeordneten Kollegen.
        </p>
        <p>
          Erledigte Aufgaben verschwinden nach{" "}
          <strong>{ausblenden} Stunden</strong> aus dem Tagesgeschäft. Gelöscht
          wird nichts.
        </p>
      </Abschnitt>

      <Abschnitt nummer={3} titel="Priorität und Kategorien">
        <p>
          Zwei Prioritäten: <strong>Normal</strong> und <strong>Hoch</strong>.
          Hoch wird rot dargestellt.
        </p>
        <p>
          Kategorien sind frei konfigurierbar und werden <em>nicht</em> nach
          onOffice übertragen – sie sind eure interne Ordnung.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {aktiveKategorien.map((k) => (
            <span key={k.name} className="chip" style={{ background: k.color, color: "var(--auf-akzent)" }}>
              {k.name}
            </span>
          ))}
        </div>
        {arten.data?.length ? (
          <p className="muted mt-2">
            Daneben gibt es {arten.data.length} Aufgabenarten aus onOffice
            (Telefonat, Termin, Rechnung und so weiter). Die kommen aus dem CRM
            und werden hier nicht gepflegt.
          </p>
        ) : null}
      </Abschnitt>

      <Abschnitt nummer={4} titel="Der Aufgabenpool">
        <p>
          Aufgaben ohne Bearbeiter liegen im Pool und sind für alle sichtbar. Wer
          eine übernimmt, zieht sie in seinen Bereich – danach ist sie aus dem
          Pool verschwunden und gehört ihm.
        </p>
        <p className="muted">
          Kommt eine Aufgabe aus onOffice und ist dort jemand als Verantwortung
          eingetragen, den das Tool kennt, aber kein Bearbeiter, landet sie
          automatisch im Pool.
        </p>
      </Abschnitt>

      <Abschnitt nummer={5} titel="Startdatum, Fälligkeit, privat">
        <p>
          Das <strong>Startdatum</strong> steuert, ab wann eine Aufgabe im
          Tagesgeschäft auftaucht. Etwas, das erst nächsten Monat ansteht, stört
          bis dahin niemanden.
        </p>
        <p>
          Die <strong>Fälligkeit</strong> ist optional und wird überfällig
          hervorgehoben.
        </p>
        <p>
          <strong>Private Aufgaben</strong> sieht nur der Ersteller. Sie lösen
          keine Mails aus und werden nicht eskaliert.
        </p>
      </Abschnitt>

      <Abschnitt nummer={6} titel="Dateien">
        <p>
          An jeder Aufgabe lassen sich Dateien ablegen, bis {maxMb} MB je Datei.
          Geöffnet werden sie über eine Adresse, die beim Klick erzeugt wird und
          fünf Minuten gilt – ein kopierter Link ist danach wertlos.
        </p>
        <p className="muted">
          Dateien wandern von hier nach onOffice, aber nicht zurück: die
          onOffice-Schnittstelle gibt die Anhänge einer Aufgabe nicht heraus.
          Hochladen und Löschen funktionieren, Lesen nicht. Deshalb ist dieses
          Tool die führende Ablage.
        </p>
      </Abschnitt>

      <Abschnitt nummer={7} titel="Erinnerungen und Eskalation">
        <p>
          Bleibt eine Aufgabe <strong>{erinnerung} Tage</strong> offen, bekommt
          der Bearbeiter eine Erinnerung. Nach{" "}
          <strong>{eskalation} Tagen</strong> geht zusätzlich eine Mail an die
          Verantwortung.
        </p>
        <p>
          Die Uhr stoppt, sobald sich der Status bewegt. Dieselbe Mail geht nie
          zweimal raus – jeder Anlass wird vor dem Versand festgehalten.
        </p>
        <p className="muted">
          Versandweg: <strong>{weg}</strong>
          {weg === "onoffice" ? " (mit Rückfall auf SMTP, falls onOffice ablehnt)" : ""}.{" "}
          {aktiveVorlagen.length} von {vorlagen.data?.length ?? 0} Vorlagen sind
          aktiv. Alle Vorlagen lassen sich unter Einstellungen ändern.
        </p>
      </Abschnitt>

      <Abschnitt nummer={8} titel="Was aus onOffice kommt">
        <p>
          Übernommen wird <strong>nur</strong>, was einen Nutzer dieses Tools als
          Bearbeiter oder als Verantwortung hat. Alles andere bleibt im CRM.
        </p>
        <p>
          Jede übernommene Aufgabe behält ihre <strong>onOffice-Nummer</strong>.
          Sie steht auf der Karte und in der Aufgabe selbst – und in der Suchleiste
          findest du eine Aufgabe, indem du einfach die Nummer eintippst. Eine reine
          Zahl wird als Nummer verstanden, alles andere als Text.
        </p>
        {mitOnoffice.length ? (
          <>
            <p>Erkannt werden derzeit:</p>
            <ul className="space-y-1">
              {mitOnoffice.map((n) => (
                <li key={n.full_name}>
                  <strong>{n.full_name}</strong> als „{n.onoffice_display_name}“
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p style={{ color: "var(--warn-fg)" }}>
            Für niemanden ist ein onOffice-Name hinterlegt – im Moment wird also
            keine einzige Aufgabe übernommen. Das wird in der Nutzerverwaltung
            eingetragen.
          </p>
        )}
        <p className="muted">
          {onofficeConfigured()
            ? "Die Zugangsdaten sind gesetzt."
            : "Achtung: die onOffice-Zugangsdaten sind in dieser Umgebung nicht gesetzt."}{" "}
          {cursor.data?.last_run_at
            ? `Letzter Abgleich: ${new Date(cursor.data.last_run_at).toLocaleString("de-DE")}.`
            : "Es lief noch kein Abgleich."}{" "}
          {nurLesen
            ? "Zurückgeschrieben wird nichts – der Rückweg ist abgeschaltet."
            : "Statusänderungen werden nach onOffice zurückgeschrieben."}
        </p>
      </Abschnitt>

      <Abschnitt nummer={9} titel="Makler und Kollegen">
        <p>
          Jede Aufgabe kann festhalten, <strong>wer sie in Auftrag gegeben
          hat</strong> – das Feld „Auftrag von (Makler)“. Es beantwortet beim
          Lesen einer Kachel die erste Frage: für wen mache ich das
          eigentlich. Derselbe Mensch bekommt die Mail, wenn die Aufgabe auf
          Rückfragen offen geht oder erledigt wird. Einen Zugang zum Tool
          braucht er dafür nicht, und in onOffice landet davon nichts.
        </p>
        <p>
          Dieselbe Liste dient noch einem zweiten Zweck: als{" "}
          <strong>Bearbeiter</strong>. Wer dort gewählt wird, wird in onOffice
          als Bearbeiter eingetragen und die Aufgabe steht danach unter
          „Verteilt“. Zwei Felder, zwei Bedeutungen – auftraggeben und
          bearbeiten ist nicht dasselbe.
        </p>
        <p className="muted">
          Derzeit {aktiveKollegen.length}{" "}
          {aktiveKollegen.length === 1 ? "Kollege" : "Kollegen"} auswählbar.
        </p>
      </Abschnitt>

      <Abschnitt nummer={10} titel="Was mitgeschrieben wird">
        <p>
          Jede Änderung an Aufgaben, Zugängen, Kollegen, Kategorien und
          Mailvorlagen wird protokolliert: wer, wann, was vorher und was nachher
          stand. Das passiert still und lässt sich nicht abschalten.
        </p>
        <p className="muted">
          Geschrieben wird es von der Datenbank selbst, nicht von der Oberfläche.
          Deshalb steht auch drin, was der automatische Abgleich getan hat – der
          erscheint als „System“. Nachzulesen unter Protokolle.
        </p>
      </Abschnitt>
    </div>
  );
}
