# Offene Punkte

Stand 9. Oktober 2026, übergeben aus dem Chat in der Claude-App an
Claude Code. Alles darüber ist eingebaut und ausgeliefert.

## Zurückgestellte Aufgaben im Dashboard, Zähler ab Frist (20. Oktober 2026)

Dashboard → „Aktueller Tag“: Liste aller Aufgaben mit Status „Rückfragen
offen“ (ab QM), älteste Rückstellung zuerst. Zähler „Tage offen“ beginnt bei
einer Frist in der Zukunft erst am Fristtag (`lib/zeit/zaehler.ts`), ebenso
Erinnerung und Eskalation: Migration `at_66_zaehler_ab_frist`
(`scripts/sql/at_66_zaehler_ab_frist.sql`). Reihenfolge: Code ausliefern,
**dann at_65, danach at_66** – at_66 baut auf der Eskalationssicht von at_65
auf. Probe gegen die echte Datenbank (nur lesend, 20.10.2026): Erinnerungen
42 → 42, Eskalationen 274 → 271 (drei Aufgaben mit Frist in der Zukunft).
Tests: `node --test lib/zeit/*.test.mjs`.

## Mails je Mitarbeiter abschalten (19. Oktober 2026)

Versandregeln → „Ausnahmen je Mitarbeiter“: der Admin schaltet jede
Mailart (außer der Pool-Meldung an die feste Adresse) für einzelne
Personen ab. Mitarbeiter stellen nichts mehr selbst um, „Meine Mails“
zeigt nur noch an. Reihenfolge: erst Code ausliefern, **dann** Migration
`at_65_mail_ausnahmen_je_person` einspielen (SQL in
`scripts/sql/at_65_mail_ausnahmen_je_person.sql`, gegen die echte
Datenbank zur Probe gelaufen und zurückgenommen: fällige Erinnerungen und
Eskalationen vorher wie nachher gleich).

## Nach dem Ausrollen prüfen

Geprüft am 9. Oktober 2026, 09:15 Uhr, in der Datenbank:

- ✅ **Asana → Tool, Bearbeiter** (Commit `b846c1d`). In der Praxis
  beobachtet: „Schlüsseleintragungen Lager" wurde um 09:07 Uhr in Asana
  von Lisa auf Eike umgestellt. Der Abgleich hat das übernommen und zwei
  Sekunden später in onOffice nachgezogen (32111, „BaufiPeissig" →
  „BaufiLensinger"). Die folgenden onOffice-Läufe haben es nicht
  zurückgedreht. Alle 15 offenen übergebenen Aufgaben stimmen zwischen
  Asana und Tool überein, „Zinsen Markus" eingeschlossen.
- ✅ Das Protokoll wächst nur noch, wenn etwas passiert: ergebnislose
  Läufe zählen eine einzige Zeile hoch (Asana rund 19.900-mal, Anhänge
  rund 7.500-mal).
- ✅ Mailversand: 17 Mails in zwei Tagen, alle verschickt, keine Fehler;
  5 Regeln angelegt.
- **Noch offen, nur in der Oberfläche prüfbar:** Das Aufgabenfenster
  schließt beim Klick auf „Erledigt" sofort; der Mail-Regelbereich im
  Admin und `/meine-mails` lassen sich bedienen.

## Wartet auf den Deploy

`scripts/sql/vorlagen-rahmen.sql` setzt die neuen Texte der beiden
Statusmails (erledigt, zurückgestellt). **Erst nach dem Ausrollen
einspielen** – die Vorlagen stehen in der Datenbank und wirken sofort,
`{{rahmen}}` füllt aber erst der neue Code. Vorher eingespielt,
verschickt das Tool Mails mit gestrichenen Platzhaltern.

## Offene Frage an Eike

„Projekt **auf H setzen**" – gemeint war vermutlich das Verschieben nach
„Buchhaltung und HR". Falls es etwas anderes bedeutet (ein eigenes Feld,
eine Spalte), muss der Asana-Abgleich das zusätzlich auswerten. Die Frage
ist bisher unbeantwortet.

## Eike erledigt in onOffice / anderswo

- **Die fehlenden Makler-Tags anlegen** (Feldkonfiguration → Aufgaben →
  Tags). Vorhanden sind nur `Lensinger`, `Spiolek`, `Marker`; es fehlen
  rund 22, und sie müssen **genau so** geschrieben sein wie in der
  Kollegenliste im Adminbereich. Ohne Tag bleibt „Auftrag von" bei den
  betreffenden Kollegen leer – der Abgleich meldet das unter
  „ohne Tag in onOffice".
- Die beiden Supportanfragen abschicken: `docs/onoffice-support-tags.md`
  (Feld gesperrt, lesend **und** schreibend) und
  `docs/onoffice-support-dateien.md`.
- onOffice-Aufgaben **31893** und **31895** von Hand löschen.

## Aufräumen, wenn Zeit ist

- Rund 4.800 alte Zeilen des Tag-Filter-Protokolls stehen noch in
  `onoffice_sync_log`; sie laufen über die 30-Tage-Aufbewahrung aus.
  Postgres gibt gelöschten Platz nicht ans Betriebssystem zurück, es
  benutzt ihn wieder – ein geschrumpftes Protokoll sieht in der
  Speicheranzeige also erst später kleiner aus.
- **Sicherheit:** das Pfalzimmo-Token aus `.git/config` entziehen, das
  GitHub-Token „Claude Task" und das SMTP-Passwort wechseln, das
  Repository von öffentlich auf privat stellen.
- Das angehaltene Vercel-Projekt `pinnwand` samt Neon-Datenbank löschen,
  falls es nicht mehr gebraucht wird.
