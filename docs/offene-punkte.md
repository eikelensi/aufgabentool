# Offene Punkte

Stand 9. Oktober 2026, übergeben aus dem Chat in der Claude-App an
Claude Code. Alles darüber ist eingebaut und ausgeliefert.

## Nach dem Ausrollen prüfen

- **Asana → Tool, Bearbeiter.** Wer in Asana zugeteilt wird, soll im Tool
  zugeteilt sein (Commit `b846c1d`). Prüffall war „Zinsen Markus":
  in Asana an Lisa Peissig, Projekt „Buchhaltung und HR"; im Tool stand
  die Aufgabe noch bei Eike. Die Zeile wurde einmal von Hand korrigiert,
  der Automatismus ist noch nicht in der Praxis beobachtet.
- Das Aufgabenfenster schließt beim Klick auf „Erledigt" sofort.
- Das Protokoll wächst nur noch, wenn wirklich etwas passiert.
- Der Mail-Regelbereich im Admin und `/meine-mails`.

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
