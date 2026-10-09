# Aufgabentool (4wändekanzlei)

Internes Aufgabenmanagement im Echtbetrieb unter **task.4waendekanzlei.de**.
Supabase als Datenbank, Anmeldung über Supabase Auth, Anbindung an onOffice
und Asana, Mailversand über onOffice mit SMTP als Rückfall.

Arbeitsregeln und die gemessenen Grenzen der onOffice-Schnittstelle stehen in
**`CLAUDE.md`**, was noch offen ist in **`docs/offene-punkte.md`**. Die
Routentabelle unten ist der Stand der Oberfläche; einige Bereiche sind seither
hinzugekommen (Asana, Verlinkungen, Archiv, eigene Mail-Einstellungen).

## Lokal starten

```bash
pnpm install      # oder npm install
pnpm dev          # http://localhost:3000
```

Next.js 15, React 19, Tailwind CSS 4. Keine weiteren Abhängigkeiten, kein Build-Setup nötig.

## Was drin ist

| Route | Inhalt |
| --- | --- |
| `/` | Weiche: ab Qualitätsmanagement ins Dashboard, sonst nach `/mein-tag` |
| `/dashboard` | Tages- und Wochenzahlen, Trichter je Mitarbeiter (ab QM) |
| `/mein-tag` | Mein Tag: Aufgabeneingang/Pool oben, darunter Board Offen · Rückfragen offen · Erledigt |
| `/pool` | Aufgabenpool mit „Übernehmen“ und Demo-Posteingang (Aufgabe aus E-Mail) |
| `/team` | Alle Mitarbeitenden nebeneinander, Einzelansicht, Kategorienansicht (früher „Übersicht“) |
| `/admin` | Kategorien, Fristen, Versandweg, E-Mail-Vorlagen, onOffice-Status, Cron-Simulation |
| `/protokoll` | Mail-Protokoll mit Dedupe-Schlüssel |

Dateien lassen sich beim Anlegen und im Detaildialog einer Aufgabe anhängen (Auswahl oder
Drag-and-drop, Typ- und Größenprüfung wie in onOffice). Im Prototyp liegen die Inhalte nur als
Blob-URL in der laufenden Browsersitzung; im Echtbetrieb übernimmt das Supabase Storage.

Benutzer oben rechts umschalten: **Sarah Bauer** = Mitarbeitersicht, **Eike Lensinger** = Adminsicht.

## Schnittstelle und Mailversand

Der onOffice-Client (`lib/onoffice/`) und der Mail-Adapter (`lib/mail/`) sind gebaut und
lesen ihre Zugangsdaten ausschließlich aus Umgebungsvariablen. Einrichtung, Verbindungstest
und die Routen stehen in **`docs/einrichtung-schnittstelle.md`**; Vorlage für die Variablen
ist `.env.example`.

| Baustein | Stand |
| --- | --- |
| HMAC v2, Request-Builder, Fehlerauswertung | fertig, Formel gegen die Doku geprüft |
| Aufgaben lesen, anlegen, Status zurückschreiben | fertig |
| Benutzerliste für Maklerkollegen | fertig |
| Objektnummer und Kundendatensatz auflösen | fertig |
| Datei an Aufgabe hängen und löschen | fertig (zweistufig, blockweise bei großen Dateien) |
| Aufgaben-Dateien lesen | von onOffice gesperrt (Code 24/25), Supportanfrage liegt bereit |
| Mailversand onOffice + SMTP-Fallback | fertig |
| Anbindung an Supabase | fertig, im Echtbetrieb |

## Datenbank

`supabase/schema.sql` enthält das vollständige Schema für Supabase (Frankfurt): Tabellen, Enums,
Trigger, Row-Level-Security-Policies, Sichten und Grunddaten. Im SQL-Editor in einem Durchgang
ausführbar, idempotent.

## Nächste Schritte

Siehe `docs/offene-punkte.md`.
