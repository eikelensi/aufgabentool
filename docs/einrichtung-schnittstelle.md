# Einrichtung: onOffice-Schnittstelle und Mailversand

Reihenfolge: Umgebungsvariablen setzen → Verbindung prüfen → Statuswerte festnageln →
Mailversand testen. Alles ohne dass Zugangsdaten den Rechner verlassen.

## 1. Umgebungsvariablen

`.env.example` nach `.env.local` kopieren und ausfüllen. `.env.local` steht in
`.gitignore` und darf nie committet werden. In Vercel dieselben Werte unter
**Settings → Environment Variables** hinterlegen.

Mindestens nötig für den ersten Test:

```
INTERNAL_API_SECRET=<openssl rand -hex 32>
ONOFFICE_API_TOKEN=<aus dem API-Benutzer in onOffice>
ONOFFICE_API_SECRET=<aus dem API-Benutzer in onOffice>
```

Der API-Benutzer braucht Leserechte auf **task**, **estate**, **address** und die
Benutzerverwaltung. Für den Mailversand zusätzlich `ONOFFICE_EMAIL_IDENTITY`.

## 2. Verbindung prüfen

Lokal (`pnpm dev`) oder gegen die Vercel-URL:

```bash
curl -s -H "x-api-secret: $INTERNAL_API_SECRET" \
  "http://localhost:3000/api/onoffice/probe" | jq
```

Der Bericht sagt Schritt für Schritt, was funktioniert. Er enthält **keine**
Zugangsdaten und kann unbesorgt weitergegeben werden. Geprüft wird:

| Schritt | Bedeutung |
| --- | --- |
| Konfiguration | Token und Secret gesetzt |
| Aufgaben lesen | Zugriff auf `resourcetype: task`, plus die **echten Status- und Prio-Werte** des Mandanten |
| Benutzerliste | Quelle für die Maklerkollegen, inkl. E-Mail-Adressen |
| Objekte lesen | Leserechte im Objektmodul |
| Aufgaben-Dateien lesen | der undokumentierte Versuch – siehe unten |
| onOffice-Mailversand | ob eine Identität gesetzt ist |
| SMTP-Verbindung | Verbindung und Anmeldung, ohne Versand |

### Den Datei-Rückweg testen

Eine onOffice-Aufgabe suchen, an der ein Anhang hängt, und deren Nummer mitgeben:

```bash
curl -s -H "x-api-secret: $INTERNAL_API_SECRET" \
  "http://localhost:3000/api/onoffice/probe?taskId=12345" | jq '.steps[] | select(.name|test("Dateien"))'
```

Antwortet die API, ist der Rückweg von onOffice möglich und wir bauen die
Zwei-Wege-Synchronisation. Antwortet sie nicht, bleibt es bei der Spiegelung ins
CRM – der Bericht zeigt dann, welche Parametervarianten versucht wurden, das ist
die Grundlage für die Support-Anfrage.

## 3. Statuswerte festnageln

Die Probe meldet unter „vorkommendeStatusWerte“ die Zahlen, die im Mandanten
wirklich benutzt werden. Diese Zuordnung dann fest eintragen:

```
ONOFFICE_STATUS_MAP=1=offen,2=in_bearbeitung,3=erledigt,4=offen
ONOFFICE_PRIO_HOCH_AB=4
```

„Zurückgestellt“ zeigt absichtlich auf `offen`, damit solche Aufgaben bei uns
sichtbar bleiben.

## 4. Mailversand

Erst prüfen, ohne zu senden:

```bash
curl -s -H "x-api-secret: $INTERNAL_API_SECRET" \
  "http://localhost:3000/api/mail/test" | jq
```

Dann eine echte Testmail an genau eine Adresse:

```bash
curl -s -X POST -H "x-api-secret: $INTERNAL_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"to":"lensinger@4-wk.de"}' \
  "http://localhost:3000/api/mail/test" | jq
```

Die Antwort nennt den benutzten Weg. Scheitert onOffice (typisch: Postfach nicht
dem API-Benutzer zugeordnet), springt automatisch SMTP ein und das Feld
`fallbackVon` sagt, warum.

SMTP-Werte für ein 4-wk.de-Postfach:

```
SMTP_HOST=<Mailserver deines Providers>
SMTP_PORT=587          # 465 wenn direktes SSL
SMTP_USER=aufgaben@4-wk.de
SMTP_PASS=<nur in der Umgebung, nirgends sonst>
SMTP_FROM=Aufgabentool 4wändekanzlei <aufgaben@4-wk.de>
```

## 5. Weitere Routen

| Route | Zweck |
| --- | --- |
| `GET /api/onoffice/tasks` | Aufgaben lesen, Filter: `processor`, `modifiedSince`, `estateId`, `limit` |
| `POST /api/onoffice/tasks` | `{"mode":"status","taskId":"123","status":"erledigt"}` schreibt den Status zurück |
| `GET /api/onoffice/users` | Benutzerliste für die Maklerkollegen |
| `POST /api/onoffice/files` | `{"taskId":"123","fileName":"x.pdf","contentBase64":"…"}` hängt eine Datei an |
| `DELETE /api/onoffice/files?taskId=123&fileId=456` | Datei in onOffice löschen |
| `GET /api/onoffice/files?taskId=123` | Leseversuch für Aufgaben-Dateien |

Alle Routen verlangen den Header `x-api-secret`. Ohne gesetztes
`INTERNAL_API_SECRET` antworten sie mit 503 und tun nichts – damit steht nichts
versehentlich offen im Netz.

## Sicherheitsnotizen

- Die HMAC-Berechnung ist gegen die Formel der Dokumentation geprüft
  (Zeitstempel + Token + Resourcetype + ActionID, SHA-256, Base64).
- Secrets stehen ausschließlich in Umgebungsvariablen: nicht im Code, nicht in
  der Datenbank, nicht in Logausgaben.
- Die Probe-Route gibt niemals Token, Secret oder Passwort zurück.
