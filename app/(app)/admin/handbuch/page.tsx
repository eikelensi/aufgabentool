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
import {
  BEREICH_LABEL,
  ROLLE_LABEL,
  STATUS_LABEL,
  darfSehen,
  type AppRole,
  type Bereich,
  type Bereichsrechte,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Handbuch – Aufgabentool" };

const ROLLE_TEXT: Record<string, string> = {
  superadmin: "sieht und darf alles, auch die Einstellungen – immer, unabhängig von jeder Einstellung",
  gf: "sieht alle Aufgaben, darf umverteilen und verwalten, dazu den Asana-Bereich",
  qm: "sieht alle Aufgaben, das Dashboard und den Team-Bereich und darf jede Aufgabe ändern – nur nicht die Verwaltung",
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

  const [einst, kategorien, nutzer, kollegen, vorlagen, cursor, arten, bereiche, spalten] =
    await Promise.all([
    sb.from("app_settings").select("*").maybeSingle(),
    sb.from("categories").select("name, color, is_active").order("sort_order"),
    sb
      .from("profiles")
      .select("full_name, role, is_active, onoffice_display_name, trichter_aktiv, trichter_grenze")
      .order("role")
      .order("full_name"),
    sb.from("broker_contacts").select("display_name, email, is_active").order("display_name"),
    sb.from("email_templates").select("key, label, is_active"),
    sb.from("onoffice_sync_cursor").select("last_run_at").eq("resource", "task").maybeSingle(),
    sb.from("task_types").select("label").eq("is_active", true).order("sort_order"),
    sb.from("rollen_bereiche").select("role, bereich, sichtbar"),
    sb.from("asana_sections").select("name, ist_pool, sort_order").order("sort_order"),
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
  const mitTrichter = aktiveNutzer.filter((n) => n.trichter_aktiv);
  const aktiveKollegen = (kollegen.data ?? []).filter((k) => k.is_active);
  const aktiveKategorien = (kategorien.data ?? []).filter((k) => k.is_active);
  const aktiveVorlagen = (vorlagen.data ?? []).filter((v) => v.is_active);

  // Wer sieht welchen Bereich - aus der Tabelle, nicht aus dem Text.
  // Damit stimmt dieser Abschnitt auch dann, wenn jemand einen Haken
  // umsetzt.
  const ROLLEN: AppRole[] = ["gf", "qm", "user"];
  const rechte: Bereichsrechte = {};
  for (const z of bereiche.data ?? []) (rechte[z.role] ??= {})[z.bereich] = z.sichtbar;
  const alleBereiche = Object.keys(BEREICH_LABEL) as Bereich[];

  const asanaSpalten = spalten.data ?? [];
  const poolSpalte = asanaSpalten.find((sp) => sp.ist_pool);

  const schalter = [
    ["Bearbeiter eintragen", s?.sync_push_assignee],
    ["Status übertragen", s?.sync_push_status],
    ["Betreff, Text, Frist, Priorität", s?.sync_push_inhalt],
    ["Neue Aufgaben anlegen", s?.sync_push_neu],
    ["Asana-Aufgaben in onOffice", s?.sync_asana_onoffice],
  ] as const;

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

        <p className="mt-3">
          Welche Rolle welchen Menüpunkt sieht, steht in der Verwaltung unter
          <strong> Rollen</strong> und lässt sich dort umstellen. Der Superadmin
          sieht immer alles – auch dann, wenn ein Haken fehlt; sonst könnte man
          sich selbst aussperren.
        </p>

        <div className="scroll-x mt-2">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="line border-b">
                <th className="py-1 pr-3 text-left font-semibold">Bereich</th>
                {ROLLEN.map((r) => (
                  <th key={r} className="px-2 py-1 text-left font-semibold">
                    {ROLLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alleBereiche.map((b) => (
                <tr key={b} className="line border-b">
                  <td className="py-1 pr-3">{BEREICH_LABEL[b]}</td>
                  {ROLLEN.map((r) => (
                    <td key={r} className="px-2 py-1">
                      {darfSehen(r, b, rechte) ? "ja" : "–"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          Drei Prioritäten: <strong>Hoch</strong>, <strong>Normal</strong> und{" "}
          <strong>Niedrig</strong>. Hoch wird rot dargestellt, Niedrig mit einem
          Pfeil nach unten.
        </p>
        <p className="muted">
          onOffice kennt fünf Stufen. Eins und zwei kommen hier als Hoch an, drei
          als Normal, vier und fünf als Niedrig; zurück geschrieben werden
          entsprechend zwei, drei und fünf. Die Priorität entscheidet auch über
          die Reihenfolge im Trichter (Abschnitt 12).
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
          braucht er dafür nicht.
        </p>
        <p>
          <strong>In onOffice heißt dasselbe „tags“.</strong> Wer dort eine
          Aufgabe anlegt und als Tag den Namen des Kollegen setzt, für den
          gearbeitet wird, findet ihn hier als „Auftrag von“ wieder – und
          umgekehrt: wird er hier gesetzt, steht er kurz darauf drüben. Der
          Abgleich läuft also in beide Richtungen, genau wie bei Betreff und
          Frist.
        </p>
        <p>
          Zusammengeführt wird über das Feld <strong>onOffice-Tag</strong> beim
          Kollegen (Verwaltung → Kollegen). Steht dort nichts, wird das Kürzel
          und der Nachname aus dem Anzeigenamen probiert – „Lensinger, Eike
          (BaufiLensinger)“ findet das Tag „Lensinger“ von allein.
        </p>
        <p className="muted">
          Ein Tag, das auf <em>zwei</em> Kollegen passt, wird ausdrücklich
          NICHT zugeordnet. „Peissig“ gibt es hier zweimal; wer rät, schickt
          die Erledigt-Mail an den Falschen. Solche Tags stehen im Protokoll
          des Abgleichs und im Aufgabenfenster unter „Auftrag von“ – einzutragen
          ist dann ein eindeutiges Tag beim richtigen Kollegen.
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

      <Abschnitt nummer={11} titel="Das Dashboard">
        <p>
          Der erste Menüpunkt, sichtbar ab dem Qualitätsmanagement, zeigt zwei
          Blicke auf dieselbe Arbeit.
        </p>
        <p>
          <strong>Aktueller Tag</strong>: oben in der Mitte, wie viele Aufgaben
          gerade im Pool liegen; darunter je Mitarbeiter zwei Kacheln – aktuelle
          Aufgaben und Aufgaben in Rückstellung. Auf derselben Kachel sitzt der
          Schalter für den Trichter (Abschnitt 12).
        </p>
        <p>
          <strong>Woche</strong>: Eingang und Ausgang des Pools, dazu je
          Mitarbeiter, wie viele Aufgaben er erhalten, zurückgestellt und
          bearbeitet hat. Man kann wochenweise zurückblättern; vorwärts nicht,
          die laufende Woche ist das Ende.
        </p>
        <p className="muted">
          Gezählt werden Ereignisse, nicht Bestände: eine Aufgabe, die Montag
          erledigt und Mittwoch wieder geöffnet wurde, steht am Montag als
          bearbeitet. Private Aufgaben zählen nirgends mit.
        </p>
        <p className="muted">
          Ab dem Qualitätsmanagement <strong>startet die Anwendung hier</strong>:
          wer verteilt und beobachtet, will zuerst wissen, wo die Arbeit liegt.
          Alle anderen starten in „Mein Tag“. Erreichbar sind beide Seiten für
          jeden, der sie sehen darf – die Startseite ist eine Weiche, keine
          Sperre.
        </p>
      </Abschnitt>

      <Abschnitt nummer={12} titel="Der Trichter (Dosierung je Mitarbeiter)">
        <p>
          Der Trichter ist eine Einstellung <em>je Person</em> und steht im
          Dashboard unter <strong>Aktueller Tag</strong> auf der Kachel des
          Mitarbeiters. Umstellen dürfen ihn Qualitätsmanagement und
          Geschäftsführung, der Mitarbeiter selbst nicht.
        </p>
        <p>
          <strong>Aus</strong> (die Voreinstellung): alles, was zugeteilt wird,
          erscheint sofort in „Mein Tag“. <strong>An</strong>: der Mitarbeiter
          sieht höchstens die eingestellte Zahl an Aufgaben. Werden ihm zwanzig
          zugeteilt und die Grenze steht auf fünf, liegen fünf auf dem Board und
          fünfzehn warten im Hintergrund. Schließt er eine ab, rückt die nächste
          nach.
        </p>
        <p>
          Zugeteilt sind sie trotzdem alle – auch in onOffice steht er bei allen
          zwanzig als Bearbeiter. Der Trichter regelt nur, was auf dem Board
          liegt, nicht, wem die Arbeit gehört. Wie viele warten, steht auf der
          Dashboard-Kachel und als Hinweis in „Mein Tag“.
        </p>
        <p>
          <strong>Die Reihenfolge</strong> bestimmt zuerst die Priorität, dann
          die Fälligkeit, dann wie lange etwas schon wartet. Aufgaben mit{" "}
          <strong>hoher Priorität warten nie</strong> – sie gehen sofort durch,
          auch wenn das Board voll ist. Dasselbe gilt für alles, was heute oder
          morgen fällig ist, und für Aufgaben, die sich jemand selbst aus dem
          Pool zieht: wer sich etwas nimmt, wird nicht ausgebremst.
        </p>
        <p className="muted">
          Eine Aufgabe in <strong>{STATUS_LABEL.in_bearbeitung}</strong> belegt
          nur einen halben Platz. Wer auf eine Rückmeldung von außen wartet, soll
          dafür nicht den halben Tag blockiert sein – bei einer Grenze von fünf
          liegen dann also mehr als fünf Karten auf dem Board.
        </p>
        <p className="muted">
          Wird der Trichter ausgeschaltet, werden alle wartenden Aufgaben sofort
          freigegeben. Es geht nichts verloren, es wird nur nichts mehr
          zurückgehalten. Aktuell {mitTrichter.length === 0
            ? "ist der Trichter bei niemandem eingeschaltet"
            : mitTrichter.length === 1
              ? `ist der Trichter bei einer Person eingeschaltet (${mitTrichter[0].full_name}, Grenze ${mitTrichter[0].trichter_grenze ?? 5})`
              : `ist der Trichter bei ${mitTrichter.length} Personen eingeschaltet: ${mitTrichter
                  .map((n) => `${n.full_name} (${n.trichter_grenze ?? 5})`)
                  .join(", ")}`}
          .
        </p>
      </Abschnitt>

      <Abschnitt nummer={13} titel="Eine Aufgabe bearbeiten">
        <p>
          Im Aufgabenfenster öffnet <strong>✎ Bearbeiten</strong> die Felder:
          Betreff, Beschreibung, Priorität, Fälligkeit und Sichtbar-ab. Die
          ersten vier gehen nach onOffice zurück, denn dort werden sie geführt –
          eine Änderung, die nur hier stünde, wäre beim nächsten Abgleich wieder
          weg. Sichtbar-ab und die Kategorie bleiben im Tool.
        </p>
        <p>
          Übertragen wird nur, was wirklich geändert wurde. Wer einen Tippfehler
          im Text korrigiert, setzt drüben nicht nebenbei die Frist neu.
        </p>
        <p className="muted">
          Der Bearbeiter, „Auftrag von (Makler)“ und die Kategorie werden direkt
          beim Auswählen gespeichert, ohne Bearbeiten-Modus.
        </p>
      </Abschnitt>

      <Abschnitt nummer={14} titel="Notizen und Nachrichten">
        <p>
          Jede Aufgabe hat einen <strong>Notizverlauf</strong> – eigene Notizen
          rechts, fremde links, Enter schickt ab. Wer schreibt, benachrichtigt
          Ersteller und Bearbeiter, nie sich selbst.
        </p>
        <p>
          Unten rechts schwebt ein <strong>Chatsymbol</strong> mit der Zahl der
          ungelesenen Nachrichten. Ein Klick auf eine Nachricht öffnet die
          Aufgabe und markiert sie gelesen. Neue Notizen erscheinen sofort, nicht
          erst im Takt.
        </p>
        <p>
          Jede Notiz geht als Kommentar nach onOffice und – bei Aufgaben aus dem
          Asana-Bereich – auch nach Asana, in der Form
          <em> „Name: Inhalt“</em>. Umgekehrt landen Kommentare aus Asana im
          Notizverlauf.
        </p>
        <p className="muted">
          Liegt das Tool in einem Hintergrund-Tab, kann es zusätzlich das System
          benachrichtigen. Die Erlaubnis dafür holt ein Knopf im
          Nachrichtenfenster; bei geschlossenem Browser geht es nicht.
        </p>
      </Abschnitt>

      <Abschnitt nummer={15} titel="Der Asana-Bereich (Geschäftsführung)">
        <p>
          Der Menüpunkt <strong>Asana</strong> spiegelt das Projekt „Buchhaltung
          und HR“: {asanaSpalten.length} Spalten, Karten mit Titel, Text,
          Zuständigem und Frist, Kommentare als Notizverlauf, Dateien wie
          überall.
        </p>
        <p>
          <strong>Asana führt.</strong> Titel, Text, Zuständigkeit und Spalte
          kommen von dort; das Tool bildet sie ab. Karten lassen sich hier
          ziehen – das schreibt nach Asana zurück. Neue Aufgaben entstehen in
          Asana und werden sofort hergeholt.
        </p>
        <p>
          Die Spalte <strong>{poolSpalte?.name ?? "Pool"}</strong> ist der
          Ausgang und steht ganz links: eine Karte, die dorthin wandert, geht in
          den Aufgabenpool des Tools, verschwindet aus diesem Board und meldet
          sich bei Geschäftsführung und Qualitätsmanagement. In Asana bleibt sie
          in der Pool-Spalte stehen – als Notiz, dass abgegeben wurde.
        </p>
        <p>
          Jede Bewegung hinterlässt dort einen Kommentar: verteilt an wen,
          zurückgespielt samt Begründung, erledigt durch wen und wann. Wird eine
          abgegebene Aufgabe in Asana abgehakt, verlässt sie auch hier den Pool.
        </p>
        <p>
          <strong>Abhaken ohne Öffnen:</strong> vor jedem Titel sitzt ein Kreis.
          Ein Klick erledigt die Aufgabe – hier, in Asana und als Kommentar
          drüben. Ein zweiter Klick macht sie wieder auf; solange die Meldung
          oben steht, nimmt „Rückgängig“ den Klick zurück.
        </p>
        <p className="muted">
          Die Seite fragt beim Öffnen, beim Zurückkommen zum Tab und alle 30
          Sekunden bei Asana nach; der Knopf ↻ fragt sofort. Erledigte Karten
          sind ausgeblendet, ein Knopf holt sie dazu.
        </p>
      </Abschnitt>

      <Abschnitt nummer={16} titel="Archiv">
        <p>
          Erledigtes verschwindet nach <strong>{ausblenden} Stunden</strong> aus
          dem Tagesgeschäft und liegt danach unter <strong>Archiv</strong> – nach
          Tagen gruppiert, mit Suche über Betreff, Text und Aufgabennummer und
          einem Haken „nur meine“.
        </p>
        <p className="muted">
          Gelöscht wird nichts. Eine zu früh abgehakte Aufgabe lässt sich dort
          öffnen und wieder aufmachen.
        </p>
      </Abschnitt>

      <Abschnitt nummer={17} titel="Was nach onOffice geschrieben wird">
        <p>
          Der Abgleich läuft alle zwei Minuten in beide Richtungen. Was das Tool
          drüben verändern darf, steht unter Verwaltung → Einstellungen und ist
          einzeln abschaltbar. Der Hauptschalter „nur lesen“ sperrt alles.
        </p>
        <p>
          Derzeit:{" "}
          <strong>{nurLesen ? "nur lesen – es wird nichts geschrieben" : "Schreiben erlaubt"}</strong>.
        </p>
        <ul className="mt-1 space-y-1">
          {schalter.map(([name, an]) => (
            <li key={name}>
              {an === true ? "✓" : "–"} {name}
            </li>
          ))}
        </ul>
        <p className="mt-2">
          Eine im Tool angelegte Aufgabe entsteht auch in onOffice, mit
          Bearbeiter und Verantwortung. Die Aufgabennummer kommt zurück und steht
          auf der Karte. Scheitert es, trägt der Abgleich es in der nächsten
          Minute nach – Fehlschläge heilen von selbst.
        </p>
        <p className="muted">
          Private Aufgaben gehen nie hinüber, unabhängig von jedem Schalter.
        </p>
      </Abschnitt>

      <Abschnitt nummer={18} titel="Objekt und Kunde verknüpfen">
        <p>
          Beim Anlegen nehmen zwei Felder eine <strong>Objektnummer</strong> und
          eine <strong>Kundennummer</strong>. Beides ist erlaubt – die Aufgabe
          hängt dann in onOffice an beiden.
        </p>
        <p>
          Gesucht wird der Reihe nach: Maklernummer, interne Objektnummer,
          Datensatz-ID; findet sich nichts als Objekt, wird dieselbe Nummer als
          Kundennummer probiert. Wer sie ins falsche Feld schreibt, bekommt also
          trotzdem eine Verknüpfung.
        </p>
        <p>
          <strong>Nachträglich:</strong> im Aufgabenfenster unter ✎ Bearbeiten
          stehen beide Felder auch bei bestehenden Aufgaben – ab dem
          Qualitätsmanagement. Eine eingetippte Nummer wird in onOffice
          nachgesehen und nur gespeichert, wenn es den Datensatz dort gibt; eine
          erfundene Nummer wäre schlimmer als ein leeres Feld.
        </p>
        <p>
          <strong>Aus onOffice:</strong> wer drüben ein Objekt an eine Aufgabe
          hängt, findet es beim nächsten Abgleich hier. Das ging lange nicht,
          und der Grund war unscheinbar – onOffice gibt die Verknüpfung nicht
          als Feld der Aufgabe heraus, sondern nur als eigene Beziehung. Jetzt
          wird die gelesen: zwei Aufrufe für alle Aufgaben eines Laufs.
        </p>
        <p className="muted">
          Gefüllt wird nur, was hier leer ist oder anders lautet. Geleert wird
          nie – findet onOffice keine Verknüpfung, kann das auch heißen, dass
          wir sie gerade erst eingetragen haben und der Weg dorthin noch vor uns
          liegt. Fehlt sie drüben, zieht der Abgleich sie nach, fünf pro Lauf,
          weil jede einen Aufruf kostet.
        </p>
        <p>
          <strong>Ein Klick genügt.</strong> Objektnummer, Kundennummer und
          Aufgabennummer sind auf jeder Karte und im Aufgabenfenster anklickbar
          und öffnen den Datensatz in onOffice in einem neuen Tab. Die Aufgabe
          hier bleibt offen, wo sie war.
        </p>
        <p className="muted">
          Im Aufgabenfenster stehen Objekt und Kunde nebeneinander, nicht
          entweder oder. Angezeigt wird die Nummer, verlinkt die Datensatz-ID:
          ein Link mit der Objektnummer führte auf ein fremdes Objekt. Fehlt die
          ID, ist die Nummer bewusst kein Link – lieber keiner als einer, der
          auf ein fremdes Objekt führt. Sobald der Abgleich die Verknüpfung
          geholt hat, wird der Chip anklickbar.
        </p>
      </Abschnitt>

      <Abschnitt nummer={19} titel="Die Begrüßung beim Anmelden">
        <p>
          Nach jedem Anmelden erscheint ein kurzes Fenster: der eigene Name, die
          offenen Aufgaben, die offenen Rückfragen und wie viel im Pool liegt.
        </p>
        <p className="muted">
          Wer angemeldet bleibt und morgens nur den Tab aufweckt, meldet sich
          nie an – für den erscheint es einmal am Tag. Gemerkt wird das im
          Browser, nicht in der Datenbank; in einem privaten Fenster erscheint es
          nicht.
        </p>
      </Abschnitt>

      <Abschnitt nummer={20} titel="Was sich am Tool ändert">
        <p>
          Jede Änderung am Tool selbst – neue Funktionen und behobene Fehler –
          steht unter <strong>Verwaltung → Protokolle → Am System geändert</strong>,
          in der Sprache der Arbeit und nicht der Programmierung. Dieses Handbuch
          wird mitgeschrieben.
        </p>
      </Abschnitt>
    </div>
  );
}
