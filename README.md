# Aufgabentool – Prototyp (4wändekanzlei)

Klickbarer Prototyp des internen Aufgabenmanagements. **Demo-Daten im Browser (localStorage),
keine Datenbank, kein Mailversand.** Dient der Abnahme von Bedienung und Logik, bevor Supabase,
Auth und die onOffice-Schnittstelle gebaut werden.

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
| Aufgaben-Dateien lesen | Leseversuch eingebaut, Ergebnis meldet die Probe-Route |
| Mailversand onOffice + SMTP-Fallback | fertig |
| Anbindung an Supabase | nächster Schritt |

## Datenbank

`supabase/schema.sql` enthält das vollständige Schema für Supabase (Frankfurt): Tabellen, Enums,
Trigger, Row-Level-Security-Policies, Sichten und Grunddaten. Im SQL-Editor in einem Durchgang
ausführbar, idempotent.

## Nächste Schritte

1. Supabase-Projekt anlegen, `schema.sql` einspielen
2. Supabase Auth anbinden, `lib/store.tsx` gegen echte Queries tauschen
3. `/api/cron/reminders` + Vercel Cron für Erinnerung (3 Tage) und Eskalation (7 Tage)
4. onOffice-Adapter: HMAC v2, `task` lesen/schreiben, `sendmail` mit `emailidentity`
