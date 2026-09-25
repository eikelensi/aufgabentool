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
    datum: "2026-09-25",
    titel: "Mitarbeiterverwaltung: das Formular stand außerhalb des Bildes",
    text: "Das Bearbeiten-Formular wurde unter der ganzen Tabelle gezeichnet – bei 25 Kollegen also zweitausend Pixel weiter unten. Wer auf „Bearbeiten“ klickte, sah nichts passieren und schloss daraus, es gebe kein Feld. Es gab eines. Jetzt klappt es direkt unter der angeklickten Zeile auf. Der onOffice-Tag steht außerdem als eigene Spalte in der Tabelle.",
    bereich: "Verwaltung",
    behoben: true,
  },
  {
    datum: "2026-09-25",
    titel: "Erledigtes verlässt den Pool sofort",
    text: "Eine Aufgabe ohne Bearbeiter, die erledigt wurde, blieb im Pool liegen – sichtbar, übernehmbar, irgendwann mit rotem Warnrand. Sie ist aber fertig. Jetzt verlässt sie den Pool im selben Moment.",
    bereich: "Aufgabenpool",
    behoben: true,
  },
  {
    datum: "2026-09-25",
    titel: "Private Aufgaben gehören jemandem",
    text: "Privat war bisher ein Zettel ohne Besitzer: sichtbar nur für den Ersteller, aber auf keinem Board. Jetzt gehört eine private Aufgabe genau einer Person und steht in ihrem Board – ohne Mail, ohne Eskalation, ohne Auswertung. Privat setzen darf man nur, was man selbst angelegt hat, was einem selbst gehört und was nie im Pool war: Fremdes versteckt man nicht, und was das Haus verteilt hat, gehört dem Haus.",
    bereich: "Alle Aufgaben",
  },
  {
    datum: "2026-09-25",
    titel: "Der Pool wird zur Schlange: älteste links, mit Warnrand",
    text: "Jede Aufgabe bekommt beim Eintritt in den Pool Datum und Uhrzeit. Die älteste steht links, die jüngste rechts – in „Mein Tag“ wie im Aufgabenpool. Auf der Karte steht, wie lange sie schon liegt; wird es zu lang, bekommt sie erst einen orangen, dann einen roten Rand. Die beiden Zeiten sind unter Einstellungen in Minuten einstellbar, 0 schaltet eine Stufe ab.",
    bereich: "Aufgabenpool, Mein Tag, Einstellungen",
  },
  {
    datum: "2026-09-25",
    titel: "Mitarbeiterverwaltung: Speichern läuft jetzt anders",
    text: "Das Formular sendet sich nicht mehr selbst ab, sondern ruft beim Klick auf „Speichern“ direkt auf – derselbe Weg, den die Einstellungen seit jeher nehmen und der dort nachweislich funktioniert. Die Felder sind gesteuert: was du tippst, steht im Zustand, und genau das wird gespeichert.",
    bereich: "Verwaltung",
    behoben: true,
  },
  {
    datum: "2026-09-25",
    titel: "Asana: zwei Bretter, Projekt und eigene Aufgaben",
    text: "Der Asana-Bereich hat jetzt oben einen Umschalter: „Projekt“ spiegelt wie bisher das Asana-Projekt, „Eigene“ die persönlichen Aufgaben aus „Meine Aufgaben“ samt deren Abschnitten. Beide haben einen Pool-Ausgang mit derselben Logik. Eine Aufgabe, die in beidem vorkommt, steht auf beiden Brettern und bleibt dabei eine einzige – abgehakt ist sie auf beiden, abgegeben verlässt sie beide.",
    bereich: "Asana",
  },
  {
    datum: "2026-09-25",
    titel: "Mitarbeiterverwaltung: Speichern sagt jetzt, was passiert ist",
    text: "Ging beim Speichern eines Kollegen etwas schief, brach die Aktion ab und auf dem Bildschirm passierte sichtbar nichts – kein Fehler, keine Meldung, keine Spur im Protokoll. Jetzt wird jeder Fehlschlag angezeigt (oben über der Tabelle und im Formular) und im Änderungsprotokoll festgehalten. Bei Erfolg steht in der Meldung, welche Felder gespeichert wurden.",
    bereich: "Verwaltung",
    behoben: true,
  },
  {
    datum: "2026-09-25",
    titel: "Beim Wechsel des Kollegen blieben die alten Werte stehen",
    text: "Wer „Bearbeiten“ bei einem Kollegen anklickte, während das Formular eines anderen offen war, sah weiter dessen Werte – gespeichert wurde aber auf den neu gewählten. Damit konnte man Name, Telefon und Standort des einen versehentlich über den anderen schreiben. Das Formular wird jetzt bei jedem Wechsel neu aufgebaut.",
    bereich: "Verwaltung",
    behoben: true,
  },
  {
    datum: "2026-09-25",
    titel: "Abgegebene Asana-Aufgaben blieben in onOffice vergeben",
    text: "Wurde eine Karte aus dem Asana-Bereich in den Pool gegeben, stand in onOffice weiter der alte Bearbeiter – und weil onOffice bei diesem Feld führt, holte der nächste Abgleich die Aufgabe prompt wieder aus dem Pool heraus und gab sie demselben Menschen zurück. Die Abgabe hielt keine fünf Minuten, und man konnte nicht sehen, warum. Jetzt wird der Bearbeiter drüben geleert, sobald die Aufgabe den Bereich verlässt.",
    bereich: "Asana, onOffice-Abgleich",
    behoben: true,
  },
  {
    datum: "2026-09-25",
    titel: "Die Abgabe hinterlässt einen Vermerk in Asana",
    text: "Die Karte bleibt in Asana in der Pool-Spalte stehen. Dort steht jetzt auch, was passiert ist: wann sie abgegeben wurde, wer als Auftraggeber erkannt wurde und dass sie in onOffice wieder frei ist. Wer sie sich später zieht, hängt wie bisher ein „Verteilt an“ darunter.",
    bereich: "Asana",
  },
  {
    datum: "2026-09-25",
    titel: "Asana-Aufgaben bringen ihren Auftraggeber in den Pool mit",
    text: "Wird eine Karte aus dem Asana-Bereich in den Pool gegeben, wird der Zuständige aus Asana als „Auftrag von“ eingetragen – ist niemand zugeteilt, der Ersteller. Wer sich die Aufgabe zieht, weiß damit ohne Nachfragen, für wen er arbeitet, und derselbe Mensch bekommt die Erledigt-Mail. Zugeordnet wird über die Mailadresse; der Name nur, wenn er eindeutig ist.",
    bereich: "Asana, Aufgabenpool",
  },
  {
    datum: "2026-09-24",
    titel: "Objekt-, Kunden- und Aufgabennummer sind anklickbar",
    text: "Auf jeder Karte öffnet ein Klick auf 🏠, 👤 oder #Nummer den Datensatz in onOffice – in einem neuen Tab, die Aufgabe hier bleibt offen. Fehlt die Datensatz-ID, bleibt die Nummer bewusst stumm: ein Link, der auf ein fremdes Objekt führt, wäre schlimmer als keiner.",
    bereich: "Alle Aufgaben",
  },
  {
    datum: "2026-09-24",
    titel: "„Auftrag von“ geht jetzt über das onOffice-Feld „tags“",
    text: "Wer in onOffice eine Aufgabe anlegt und als Tag den Kollegen setzt, für den gearbeitet wird, findet ihn hier als „Auftrag von“ wieder – und umgekehrt. Zusammengeführt wird über das neue Feld „onOffice-Tag“ beim Kollegen (Verwaltung → Kollegen); ohne Eintrag werden Kürzel und Nachname probiert. Ein Tag, das auf zwei Kollegen passt, wird nicht zugeordnet – an dem Feld hängt, wer die Erledigt-Mail bekommt.",
    bereich: "onOffice-Abgleich, Verwaltung",
  },
  {
    datum: "2026-09-24",
    titel: "Verknüpfte Objekte kamen nie aus onOffice an",
    text: "Wer in onOffice ein Objekt an eine Aufgabe hängte, sah es im Tool nicht – 136 Aufgaben aus dem CRM, keine einzige mit Objekt. onOffice gibt die Verknüpfung nicht als Feld der Aufgabe heraus, sondern nur als eigene Beziehung; abgefragt wurde aber das Feld, und das war immer leer. Schlimmer noch: jeder Lauf hat damit eine von Hand eingetragene Verknüpfung wieder gelöscht. Jetzt wird die Beziehung gelesen, dazu die Objekt- und Kundennummer.",
    bereich: "onOffice-Abgleich",
    behoben: true,
  },
  {
    datum: "2026-09-24",
    titel: "Objekt und Kunde nachträglich verknüpfen",
    text: "Unter ✎ Bearbeiten stehen Objektnummer und Kundennummer jetzt auch bei bestehenden Aufgaben, dazu der Privat-Haken. Eine Nummer wird in onOffice nachgesehen und nur gespeichert, wenn es den Datensatz dort gibt. Im Fenster stehen Objekt und Kunde nebeneinander statt entweder oder, und der Link führt über die Datensatz-ID – vorher stand die Objektnummer im Link und führte ins Leere.",
    bereich: "Aufgabe bearbeiten",
  },
  {
    datum: "2026-09-24",
    titel: "Qualitätsmanagement darf jede Aufgabe ändern",
    text: "QM sah bisher nur eigene Aufgaben und den Pool – die Zeilensicherheit der Datenbank kannte die Rolle nicht. Damit blieben Team-Bereich, Dashboard und Trichter für QM leer. Jetzt gilt für Aufgaben der weitere Kreis: sehen, ändern, zuteilen, verknüpfen. Die Verwaltung (Einstellungen, Nutzer, Kategorien) und das Löschen bleiben der Geschäftsführung.",
    bereich: "Alle Seiten",
    behoben: true,
  },
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
