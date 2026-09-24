/**
 * Was sich am System geaendert hat.
 *
 * Von Hand gepflegt, und das ist Absicht: die Liste soll lesbar sein
 * fuer jemanden, der das Tool benutzt und nicht programmiert. Aus den
 * Entwicklungsnachrichten erzeugt waere sie vollstaendig, aber
 * unverstaendlich - "resourceid statt identifier" hilft niemandem.
 *
 * Neue Eintraege kommen OBEN dazu. Jeder sagt, was sich fuer die
 * Arbeit aendert, nicht was im Code passiert ist.
 */

export interface Aenderung {
  /** ISO-Datum, JJJJ-MM-TT. */
  datum: string;
  titel: string;
  /** Was das fuer die Arbeit bedeutet. Ein bis drei Saetze. */
  text: string;
  /** Wo im Tool man es merkt. */
  bereich?: string;
  /** Behobener Fehler statt neuer Funktion. */
  behoben?: boolean;
}

export const AENDERUNGEN: Aenderung[] = [
  {
    datum: "2026-09-24",
    titel: "Asana: abhaken ohne Öffnen",
    text: "Vor jedem Titel sitzt jetzt ein Kreis. Ein Klick erledigt die Aufgabe – in der Datenbank, in Asana und als Vermerk in den Kommentaren. Ein zweiter Klick macht sie wieder auf; für Fehlklicks gibt es „Rückgängig“ in der Meldungszeile.",
    bereich: "Asana",
  },
  {
    datum: "2026-09-24",
    titel: "Aus „Übersicht“ wird „Team“",
    text: "Der Menüpunkt heißt jetzt Team und steht direkt hinter dem Dashboard, vor „Mein Tag“. Die Ansicht nach Mitarbeitenden ist deutlich kompakter: Karten wurden zu Zeilen, jede Zelle zeigt drei statt vier – damit passen alle Mitarbeitenden auf einen Blick auf den Bildschirm. Alles zu einer Aufgabe steht weiterhin im Aufgabenfenster.",
    bereich: "Team",
  },
  {
    datum: "2026-09-24",
    titel: "Ab QM startet die Anwendung im Dashboard",
    text: "Wer verteilt und beobachtet, will zuerst wissen, wo die Arbeit liegt. Qualitätsmanagement und Geschäftsführung landen nach dem Anmelden im Dashboard, alle anderen in „Mein Tag“. Beide Seiten bleiben über das Menü erreichbar.",
    bereich: "Alle Seiten",
  },
  {
    datum: "2026-09-24",
    titel: "Trichter: Aufgaben dosiert zuteilen",
    text: "Im Dashboard lässt sich je Mitarbeiter ein Trichter einschalten. Wer zwanzig Aufgaben bekommt, sieht dann nur die eingestellte Zahl – schließt er eine ab, rückt die nächste nach. Zugeteilt sind trotzdem alle, auch in onOffice. Hohe Priorität, alles bis morgen Fällige und selbst aus dem Pool Gezogenes geht immer sofort durch.",
    bereich: "Dashboard, Mein Tag",
  },
  {
    datum: "2026-09-24",
    titel: "Dritte Priorität: Niedrig",
    text: "Neben Hoch und Normal gibt es jetzt Niedrig. onOffice kennt fünf Stufen; eins und zwei kommen als Hoch an, drei als Normal, vier und fünf als Niedrig. Im Trichter rücken niedrige Aufgaben zuletzt nach.",
    bereich: "Alle Aufgaben",
  },
  {
    datum: "2026-09-24",
    titel: "Dashboard mit Tages- und Wochenzahlen",
    text: "Neuer erster Menüpunkt, sichtbar ab dem Qualitätsmanagement: aktuelle Aufgaben und Rückstellungen je Mitarbeiter, der Pool-Stand oben in der Mitte, und eine Wochenansicht mit Pool-Ein- und -Ausgang und den Zahlen je Mitarbeiter. Wochenweise zurückblättern.",
    bereich: "Dashboard",
  },
  {
    datum: "2026-09-24",
    titel: "Begrüßung beim Anmelden",
    text: "Nach jedem Anmelden erscheint ein kurzes Fenster mit Namen, offenen Aufgaben, offenen Rückfragen und der Zahl der Aufgaben im Pool. Wer angemeldet bleibt, sieht es einmal am Tag.",
    bereich: "Alle Seiten",
  },
  {
    datum: "2026-09-24",
    titel: "Menü bricht um statt zu scrollen",
    text: "Mit sieben Menüpunkten war die Zeile voll und der letzte Punkt – das Archiv – lag außerhalb des Bildes. Die Leiste bricht jetzt in eine zweite Zeile um.",
    bereich: "Alle Seiten",
    behoben: true,
  },
  {
    datum: "2026-09-24",
    titel: "Archiv für erledigte Aufgaben",
    text: "Erledigtes verschwindet nach 48 Stunden aus dem Tagesgeschäft und liegt danach im Archiv – nach Tagen gruppiert, mit Suche und einem Haken „nur meine“. Gelöscht wird nichts.",
    bereich: "Archiv",
  },
  {
    datum: "2026-09-24",
    titel: "Objekt UND Kunde verknüpfen",
    text: "Objektnummer und Kundennummer sind zwei eigene Felder; beide Verknüpfungen werden in onOffice gesetzt. Wer die Nummer ins falsche Feld schreibt, bekommt sie trotzdem zugeordnet.",
    bereich: "Aufgabe anlegen",
  },
  {
    datum: "2026-09-24",
    titel: "Kundenverknüpfung kam in onOffice nicht an",
    text: "Die Adress-ID wurde als Text statt als Zahl übergeben; onOffice hat sie stillschweigend verworfen. Verknüpfungen werden jetzt ausdrücklich gesetzt, und der Abgleich zieht nach, wo sie fehlen.",
    bereich: "onOffice-Abgleich",
    behoben: true,
  },
  {
    datum: "2026-09-24",
    titel: "Anlegen-Fenster schließt sofort",
    text: "Es wartete auf onOffice, den Datei-Upload und das Nachladen der Liste. Jetzt geht es zu, sobald die Aufgabe gespeichert ist; alles andere läuft im Hintergrund weiter.",
    bereich: "Aufgabe anlegen",
  },
  {
    datum: "2026-09-24",
    titel: "Notizen laufen in beide Richtungen",
    text: "Jede Notiz wird zum Kommentar in onOffice und in Asana – auch bei Aufgaben, die aus dem Asana-Bereich in den Pool abgegeben wurden. Umgekehrt landen Asana-Kommentare im Notizverlauf.",
    bereich: "Aufgabe, Notizen",
  },
  {
    datum: "2026-09-24",
    titel: "Rückfragen offen nennt den Grund überall",
    text: "Die Pflichtbegründung steht jetzt im Notizverlauf, im onOffice-Kommentar und als Vermerk in Asana – nicht mehr nur in einem Feld, das die nächste Rückfrage überschreibt.",
    bereich: "Status",
  },
  {
    datum: "2026-09-24",
    titel: "Erledigt gilt in allen drei Systemen",
    text: "Im Tool abgehakt heißt in onOffice und Asana abgehakt. In Asana abgehakt heißt: die Aufgabe verlässt den Aufgabenpool, damit niemand Arbeit übernimmt, die schon getan ist.",
    bereich: "Status",
  },
  {
    datum: "2026-09-24",
    titel: "Asana-Aufgaben anlegen und zuteilen",
    text: "Im Asana-Board legt ein Knopf oben und ein Plus in jeder Spalte eine Aufgabe an – sie entsteht in Asana und wird sofort hergeholt. Spalte, Zuständigkeit und Frist lassen sich im Aufgabenfenster ändern und gehen nach Asana zurück.",
    bereich: "Asana",
  },
  {
    datum: "2026-09-24",
    titel: "Lebenslauf einer Aufgabe in Asana",
    text: "Verteilt an, zurückgespielt in den Pool samt Begründung, erledigt durch und wieder geöffnet – jede dieser Bewegungen hinterlässt einen Kommentar an der Asana-Karte.",
    bereich: "Asana",
  },
  {
    datum: "2026-09-24",
    titel: "Asana-Board aktualisiert sich selbst",
    text: "Die Seite fragt beim Öffnen, beim Zurückkommen zum Tab und alle 30 Sekunden bei Asana nach; ein Knopf fragt sofort. Der Abgleich schreibt nur noch, was sich wirklich geändert hat.",
    bereich: "Asana",
  },
  {
    datum: "2026-09-24",
    titel: "Aufgaben aus dem Tool erscheinen in onOffice",
    text: "Das Pflichtfeld „Art“ verlangt eine Zahl, nicht das Wort. Die Art wird jetzt aus dem Bestand ermittelt, und der Abgleich trägt jede Minute nach, was drüben fehlt – Fehlschläge heilen von selbst.",
    bereich: "onOffice-Abgleich",
    behoben: true,
  },
  {
    datum: "2026-09-23",
    titel: "Asana-Bereich für die Geschäftsführung",
    text: "Ein eigener Menüpunkt mit dem Board aus „Buchhaltung und HR“: Spalten wie in Asana, Kommentare als Notizverlauf, Dateien wie überall. Asana führt. Über die Spalte „Pool“ wandert eine Aufgabe in den Aufgabenpool des Tools.",
    bereich: "Asana",
  },
  {
    datum: "2026-09-23",
    titel: "Rollen heißen nach Funktion",
    text: "Superadmin, Geschäftsführung, Qualitätsmanagement, Mitarbeiter. Unter Verwaltung → Rollen wird je Rolle angehakt, welchen Bereich sie im Menü sieht. Der Superadmin sieht immer alles.",
    bereich: "Verwaltung",
  },
  {
    datum: "2026-09-23",
    titel: "Notizen wurden ein Gespräch",
    text: "Statt eines Feldes, das die nächste Notiz überschrieb, gibt es einen Verlauf. Wer schreibt, benachrichtigt Ersteller und Bearbeiter; unten rechts zeigt ein Chatsymbol die ungelesenen Nachrichten.",
    bereich: "Aufgabe, Notizen",
  },
  {
    datum: "2026-09-23",
    titel: "Aufgaben nachträglich bearbeiten",
    text: "Betreff, Beschreibung, Priorität, Fälligkeit und Sichtbar-ab lassen sich im Aufgabenfenster ändern. Die ersten vier gehen nach onOffice zurück, weil sie dort geführt werden.",
    bereich: "Aufgabe",
  },
  {
    datum: "2026-09-23",
    titel: "Kategorie an bestehenden Aufgaben",
    text: "Das Feld gab es nur beim Anlegen – und fast jede Aufgabe kommt aus onOffice. Jetzt steht die Kategorie im Aufgabenfenster und ist beim Anlegen nicht mehr vorausgewählt.",
    bereich: "Aufgabe",
    behoben: true,
  },
  {
    datum: "2026-09-22",
    titel: "Dateien nach onOffice",
    text: "Was im Tool angehängt wird, hängt kurz darauf an der onOffice-Aufgabe. Der Rückweg ist gesperrt: für Aufgaben-Dateien ist der Abruf im Mandanten nicht eingerichtet. Ein Knopf öffnet die Aufgabe dort.",
    bereich: "Dateien",
  },
  {
    datum: "2026-09-22",
    titel: "Zurück in den Pool mit Begründung",
    text: "Wer eine Aufgabe zurückgibt, erklärt kurz warum. Die Begründung steht an der Karte, und eine Mail geht an hilfe@4-wk.de mit Aufgabennummer, Titel, Auftraggeber und Grund.",
    bereich: "Aufgabenpool",
  },
  {
    datum: "2026-09-22",
    titel: "Oberfläche merkt Änderungen von außen",
    text: "Vorher zeigte ein offener Tab den Stand von morgens. Jetzt lädt die Seite beim Zurückkommen nach, im Takt und sofort, wenn die Datenbank eine Änderung meldet.",
    bereich: "Alle Seiten",
    behoben: true,
  },
  {
    datum: "2026-09-22",
    titel: "Status und Bearbeiter gehen nach onOffice",
    text: "Wer sich eine Aufgabe zieht, steht drüben als Bearbeiter; ein Statuswechsel wird übertragen. Jeder Schreibweg ist unter Verwaltung → Einstellungen einzeln abschaltbar.",
    bereich: "onOffice-Abgleich",
  },
];
