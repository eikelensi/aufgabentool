# Aufgabentool – Arbeitsanleitung für Claude

Internes Aufgabenmanagement der **4wändekanzlei GmbH** (Immobilienmakler,
Büros Frankenthal, Alzey, Darmstadt, elf Makler). Läuft unter
**task.4waendekanzlei.de** auf Vercel. Auftraggeber und einziger
Entwicklungspartner: **Eike Lensinger** (Geschäftsführer).

## Umgangsregeln

- **Alles auf Deutsch** – Code-Kommentare, Commit-Texte, Oberfläche,
  Antworten im Chat. Keine englischen Variablennamen in neuem Code.
- **Nie pushen.** Commits anlegen ist in Ordnung, `git push` macht Eike
  selbst. Nach einem Commit den Push-Befehl nennen, nicht ausführen.
- **Keine Mutmaßungen über die Schnittstelle.** Was unten unter „Harte
  Fakten" steht, ist gegen den echten Mandanten gemessen. Behauptungen
  ohne Messung haben in diesem Projekt schon Tage gekostet.
- Prüfen vor dem Melden: `npx tsc --noEmit -p tsconfig.json`. Es gibt
  keinen Netzzugang in der lokalen Entwicklungs-VM, also kein
  `npm install` und kein `next build` dort.
- Eike arbeitet nicht mit Fachjargon. Fehler offen benennen, auch eigene.

## Stack

Next.js 15.5 App Router (Routengruppe `app/(app)/`), React 19,
Tailwind 4, Supabase Postgres mit RLS, Vercel Cron.

| Ort | Inhalt |
|---|---|
| `lib/store.tsx` | der Zustand der Anwendung, größte Datei, Optimistic UI |
| `lib/onoffice/` | Client (HMAC v2), Aufgaben, Dateien, Notizen, Feldproben |
| `lib/asana/` | Asana-REST-Client |
| `lib/sync/` | die Abgleiche in beide Richtungen, Bearbeiterlogik, Protokoll |
| `lib/mail/` | Versand, Vorlagen, Versandregeln |
| `app/api/` | Routen für Cron, Schnittstellen und Serveraktionen |
| `supabase/schema.sql` | Schema; Änderungen laufen als Migration `at_NN` |
| `docs/` | Betrieb, Einrichtung, Supportanfragen, offene Punkte |

Supabase-Projekt: `zopntlggvtcdwmuvayxs` (Frankfurt). Migrationen werden
fortlaufend `at_50`, `at_51`, … benannt; letzte vergebene Nummer steht in
der Migrationsliste des Projekts. **Reihenfolge einhalten: erst Code
ausliefern, dann Migration einspielen** – andersherum arbeitet die alte
Version mit neuen Spalten und legt Daten falsch ab.

Vier Cron-Läufe in `vercel.json`: onOffice-Abgleich und Anhänge alle zwei
Minuten, Asana-Abgleich jede Minute, Mail-Eskalation stündlich (die Route
entscheidet selbst, welche Stunde dran ist).

## Harte Fakten zur onOffice-Schnittstelle (gemessen, nicht gelesen)

- HMAC v2 ist die reine Verkettung `timestamp + token + resourcetype +
  actionid`, SHA-256, Secret als Text, Base64. Variante mit Bezeichnern
  wird mit Code 137 abgelehnt.
- **`Nr` ist ein Filterfeld und darf nicht im `data`-Block stehen.** Das
  hat schon mehrere Proben ungültig gemacht.
- `listoffset` und `sortby` werden bei `task` abgelehnt (Code 144). Es
  gibt kein Blättern; ein Lauf holt höchstens 500 Aufgaben.
- Das Multiselect-Feld **`tags` ist gesperrt – lesend und schreibend**
  (Code 144, z. B. `Invalid field in input data: "(tags, Lensinger)"`).
  `createTask` und `modifyTask` wiederholen den Aufruf deshalb ohne
  `tags`, statt den ganzen Schreibvorgang zu verlieren.
- Der **Filter** auf `tags` funktioniert dagegen, mit dem internen
  Schlüssel (`indMulti3818Select6324`). Darauf beruht
  `lib/sync/tag-abgleich.ts`.
- Dateien einer Aufgabe sind nicht lesbar (Code 24 / 25). Hochladen und
  Löschen gehen. Dieses Tool ist die führende Ablage.
- `Kommentar` existiert im Mandanten nicht; die Pflichtnotiz bleibt hier.
- Die Benutzerliste (`get` auf `users`) gibt nur Mailadressen her. Namen
  der Kollegen stehen in den Aufgaben selbst (`Bearbeiter`,
  `Verantwortung`), Kürzel notfalls in `broker_contacts.short_code`.

Mehr dazu in `docs/betrieb.md`. Offene Supportanfragen an onOffice liegen
als `docs/onoffice-support-*.md` bereit.

## Asana

Aufgaben können aus dem Tool nach Asana übergeben werden (`lib/sync/
asana-uebergabe.ts`), beim Anlegen ist wählbar, ob sie zusätzlich in
onOffice entsteht oder **stumm** bleibt (`tasks.onoffice_stumm`). Der
Abgleich zurück (`lib/sync/asana.ts`) übernimmt Erledigt-Status **und**
den Bearbeiter: wer in Asana zugeteilt wird, ist auch im Tool zugeteilt –
außer die Karte liegt in der Pool-Spalte. Eigene Aufgaben werden je
Person auf ein eigenes Board gespiegelt
(`profiles.asana_spiegel_bereich`, `asana_spiegel_section_gid`).

## Protokollierung

Drei Regeln in `lib/sync/protokoll.ts`, weil die Protokolle vorher
vorwiegend festgehalten haben, dass nichts passiert ist: ergebnislose
Läufe zählen eine `ruhig:<resource>`-Zeile hoch, gleiche Meldung binnen
24 Stunden erhöht `anzahl`, der volle `payload` nur im Fehlerfall.
Aufbewahrung in `lib/sync/protokoll-aufraeumen.ts`, einstellbar im
Adminbereich, `0 = nie löschen`.
