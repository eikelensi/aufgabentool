# Datenbank

Maßgeblich ist das Supabase-Projekt `zopntlggvtcdwmuvayxs` (Region Frankfurt).
Dort liegen die Migrationen `at_01` bis `at_08`, angewendet am 16.09.2026.

`schema.sql` ist der Entwurf, aus dem sie entstanden sind. Er ist weiterhin
lesbar als Gesamtbild, aber nicht mehr wortgleich mit der Datenbank — beim
Einspielen kamen folgende Änderungen hinzu:

- **`task_types`** (neu): die Aufgabenarten des onOffice-Mandanten, 35 Stück,
  übernommen aus dem vorherigen Stand. `onoffice_art_id` ist absichtlich leer,
  siehe unten.
- **`tasks`**: zusätzlich `task_type_id`, `onoffice_modified_at`,
  `onoffice_status_raw`, `sync_hash`, `sync_error` — der Sync braucht sie,
  um Änderungen zu erkennen und die Statusabbildung nachprüfbar zu halten.
- **`app_settings`**: zusätzlich `sync_interval_minutes`,
  `sync_overlap_minutes`, `sync_read_only`. Solange `sync_read_only` auf
  `true` steht, schreibt nichts nach onOffice zurück.
- **`onoffice_sync_cursor`** (neu): Merker, bis zu welchem `modified`-Wert
  der letzte Abruf gelesen hat.
- Die drei Sichten laufen mit `security_invoker = true`. Ohne das würden sie
  die Zeilensicherheit auf `tasks` umgehen und jeder Mitarbeiter sähe alle
  Aufgaben — ein Fehler im ursprünglichen Entwurf.
- `my_role()`, `is_admin()` und `can_touch_task_file()` sind für `anon`
  gesperrt. Als `security definer`-Funktionen wären sie sonst über
  `/rest/v1/rpc/...` auch ohne Anmeldung aufrufbar gewesen.

## Vorgeschichte

Im Projekt lag bis zum 16.09.2026 ein anderes, früher gebautes Aufgabentool:
`organizations`, `app_users`, `boards`, `board_columns`, `tasks` mit 239
gespiegelten Aufgaben, `sync_runs` mit 3.991 Läufen. Der Sync dort lief
ausschließlich lesend (`sync_read_only = true`), und die Aufgaben trugen keine
lokalen Zusätze — keine Notizen, keine Kategorien, keine Maklerzuordnung, keine
Kommentare. Nur drei Aufgaben existierten rein lokal, alle mit dem Titel „Test".

Dieser Bestand wurde auf Wunsch entfernt. Die Konfiguration liegt in
`sicherung-altbestand-2026-09-16.json`: Boards, Spalten, Einstellungen samt
Konfliktstrategie, die Automatikregel und die 35 Aufgabenarten.

**Wichtig zu den Aufgabenarten:** im alten Stand trugen sie die
`onoffice_art_id` 0 bis 34 — also schlicht ihre Position in der Liste. Das sind
nicht die echten IDs des Mandanten; an echten Aufgaben wurden 167, 279 und 441
gemessen. Die Beschriftungen sind übernommen, die Zuordnung zur ID muss der
Sync neu ermitteln.
