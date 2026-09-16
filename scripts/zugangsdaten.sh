#!/usr/bin/env bash
# Traegt Zugangsdaten in .env.local ein.
#   bash scripts/zugangsdaten.sh            -> onOffice-API
#   bash scripts/zugangsdaten.sh smtp       -> SMTP-Postfach
# Passwoerter und Secrets werden bei der Eingabe nicht angezeigt und landen
# nicht in der Shell-History.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "Keine .env.local gefunden. Bitte im Projektordner ausfuehren." >&2
  exit 1
fi

WAS="${1:-onoffice}"

schreibe() {
  # schreibe KEY WERT  – ersetzt die Zeile oder haengt sie an
  KEY="$1" WERT="$2" node -e '
const fs = require("fs");
const p = ".env.local";
const lines = fs.readFileSync(p, "utf8").split("\n");
const key = process.env.KEY, value = process.env.WERT;
const i = lines.findIndex((l) => l.startsWith(key + "="));
if (i >= 0) lines[i] = key + "=" + value; else lines.push(key + "=" + value);
fs.writeFileSync(p, lines.join("\n"), { mode: 0o600 });
'
}

if [ "$WAS" = "smtp" ]; then
  echo ""
  echo "=== SMTP-Postfach eintragen (4-wk.de) ==="
  echo "Host, Port und Benutzer sind sichtbar, das Passwort nicht."
  echo ""
  printf "SMTP-Host (z.B. mail.your-server.de): "
  read -r SMTP_HOST
  printf "Port [587]: "
  read -r SMTP_PORT
  SMTP_PORT="${SMTP_PORT:-587}"
  printf "Benutzer (z.B. aufgaben@4-wk.de): "
  read -r SMTP_USER
  printf "Passwort: "
  read -rs SMTP_PASS
  echo ""
  printf "Absender [Aufgabentool 4waendekanzlei <%s>]: " "$SMTP_USER"
  read -r SMTP_FROM
  SMTP_FROM="${SMTP_FROM:-Aufgabentool 4waendekanzlei <$SMTP_USER>}"

  if [ -z "$SMTP_HOST" ] || [ -z "$SMTP_USER" ] || [ -z "$SMTP_PASS" ]; then
    echo ""
    echo "Abgebrochen: Host, Benutzer oder Passwort war leer. Nichts geaendert."
    exit 1
  fi

  schreibe SMTP_HOST "$SMTP_HOST"
  schreibe SMTP_PORT "$SMTP_PORT"
  schreibe SMTP_USER "$SMTP_USER"
  schreibe SMTP_PASS "$SMTP_PASS"
  schreibe SMTP_FROM "$SMTP_FROM"

  echo ""
  echo "Gespeichert in .env.local."
  echo ""
  echo "Naechster Schritt – Verbindung pruefen, ohne zu senden:"
  echo "  npm run smtp"
  echo "Testmail an dich selbst:"
  echo "  npm run smtp $SMTP_USER"
  echo ""
  exit 0
fi

echo ""
echo "=== onOffice-Zugangsdaten eintragen ==="
echo "Die Eingabe wird ausgeblendet. Nichts davon erscheint auf dem Bildschirm."
echo ""

printf "API-Token:  "
read -rs OO_TOKEN
echo ""
printf "API-Secret: "
read -rs OO_SECRET
echo ""

if [ -z "$OO_TOKEN" ] || [ -z "$OO_SECRET" ]; then
  echo ""
  echo "Abgebrochen: Token oder Secret war leer. Nichts geaendert."
  exit 1
fi

schreibe ONOFFICE_API_TOKEN "$OO_TOKEN"
schreibe ONOFFICE_API_SECRET "$OO_SECRET"

echo ""
echo "Gespeichert in .env.local (nur fuer dich lesbar, nicht im Git)."
echo ""
echo "Naechster Schritt:  npm run probe"
echo ""
