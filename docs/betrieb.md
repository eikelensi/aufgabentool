# Betrieb

## Zeitplan (Vercel Cron)

`vercel.json` legt drei Läufe fest. Die Zeiten sind **UTC** — im Sommer
liegt Berlin zwei Stunden davor, im Winter eine.

| Pfad | Takt | Wozu |
|---|---|---|
| `/api/sync/onoffice` | alle 15 Minuten | Aufgaben aus dem CRM holen |
| `/api/mail/eskalation` | täglich 05:00 UTC (07:00 Berlin) | Erinnerung nach 3, Eskalation nach 7 Tagen |
| `/api/sync/anhaenge` | alle 30 Minuten | wartende Dateien nach onOffice spiegeln |

Damit die Läufe nicht von jedem aufgerufen werden können, prüfen die Routen
eine von drei Berechtigungen: den Header `x-api-secret` mit
`INTERNAL_API_SECRET`, den von Vercel gesetzten `Authorization: Bearer
<CRON_SECRET>`, oder eine angemeldete Adminsitzung.

**`CRON_SECRET` muss in Vercel gesetzt sein**, sonst laufen die
Zeitpläne ins 403. Einen beliebigen langen Zufallswert nehmen, zum Beispiel
`openssl rand -hex 32`.

## Mailversand

Zwei verschiedene Postausgänge, nicht verwechseln:

1. **Supabase Auth** verschickt Einladungen und „Passwort vergessen". Das
   konfiguriert man im Supabase-Dashboard unter Authentication → SMTP
   Settings. Ohne eigenen SMTP-Zugang bremst Supabase nach wenigen Mails.
2. **Das Tool selbst** verschickt Benachrichtigungen und Eskalationen. Der
   Weg steht in `app_settings.mail_provider` und lässt sich mit
   `MAIL_PROVIDER` überschreiben: `onoffice`, `smtp` oder `log`. Bei
   `onoffice` wird automatisch auf SMTP zurückgefallen, wenn der Mandant
   den Versand nicht freigeschaltet hat; `log` schreibt nur in die
   Serverkonsole und ist für Trockenläufe gedacht.

Doppelversand ist über `notifications_log.dedupe_key` ausgeschlossen: der
Protokolleintrag wird **vor** dem Senden angelegt und beansprucht damit den
Anlass. Ein zweiter Lauf scheitert am eindeutigen Index und sendet nichts.

## Grenzen der onOffice-Schnittstelle

Gegen den Mandanten gemessen, nicht aus der Dokumentation:

- **HMAC v2** ist die reine Verkettung `timestamp + token + resourcetype +
  actionid`, SHA-256 mit dem Secret als Text, Base64. Die Variante mit
  Bezeichnern wird mit Code 137 abgelehnt.
- **Dateien einer Aufgabe sind nicht lesbar.** `file` + `task` meldet Code
  24, `fileRelation` ist nicht lesbar (Code 25). Hochladen und Löschen
  gehen. Deshalb ist dieses Tool die führende Ablage und spiegelt nur
  hinaus.
- **Blättern gibt es nicht.** `listoffset` und `sortby` werden für
  Aufgaben abgelehnt (Code 144). Aktuelle Aufgaben kommen über einen
  Filter auf `modified`; ein Lauf holt höchstens 500 Aufgaben und meldet,
  wenn er an diese Grenze stößt.
- **Der Lesecall nimmt 18 Felder.** `Nr`, `newValue`, `hochgeladenAm` und
  `tags` stehen in der Feldkonfiguration, werden aber abgelehnt. Der Code
  liest abgelehnte Feldnamen aus der Fehlermeldung und lässt sie weg.
- **`Kommentar` existiert im Mandanten nicht.** Die Pflichtnotiz kann
  daher nicht nach onOffice geschrieben werden, sie bleibt hier.
- **Die Benutzerliste gibt nur Mailadressen her.** Abgefragt wird sie mit
  der Aktion `get` auf `users`, nicht mit `read`. Alle anderen Felder –
  Vorname, Nachname, Kürzel, Telefon, Standort – kommen leer zurück. Die
  Namen der Kollegen stehen dagegen in den Aufgaben selbst, in den Feldern
  `Bearbeiter` und `Verantwortung`.

## Welche Aufgaben kommen ins Tool

Nur die, bei denen **Bearbeiter oder Verantwortung ein Nutzer des Tools
ist**. Verglichen wird `profiles.onoffice_display_name` mit dem String aus
onOffice, ohne Rücksicht auf Groß- und Kleinschreibung und auf
Mehrfach-Leerzeichen.

Fehlt dieser Name bei einer Person, werden für sie keine Aufgaben geholt.
Der Adminbereich zeigt das an und listet unter „Namen aus onOffice ohne
Zuordnung", welche Namen in geholten Aufgaben vorkommen, aber zu keinem
Nutzer gehören.

Ist die Verantwortung bekannt und der Bearbeiter nicht, landet die Aufgabe
im Pool — dann zieht sie sich jemand selbst.
