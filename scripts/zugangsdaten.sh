#!/usr/bin/env bash
# Traegt Zugangsdaten in .env.local ein, ohne sie anzuzeigen.
#
#   npm run zugangsdaten            -> onOffice API-Token und Secret
#   npm run zugangsdaten smtp       -> SMTP-Postfach
#   npm run zugangsdaten supabase   -> Supabase Service-Role-Schluessel
#
# Eingaben erscheinen nicht auf dem Bildschirm und landen nicht in der
# Shell-History.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "Keine .env.local gefunden. Bitte im Projektordner ausfuehren." >&2
  exit 1
fi

WAS="${1:-onoffice}"

schreibe() {
  KEY="$1" WERT="$2" node -e '
const fs = require("fs");
const p = ".env.local";
const lines = fs.readFileSync(p, "utf8").split("\n");
const key = process.env.KEY, value = (process.env.WERT || "").trim();
const i = lines.findIndex((l) => l.startsWith(key + "="));
if (i >= 0) lines[i] = key + "=" + value; else lines.push(key + "=" + value);
fs.writeFileSync(p, lines.join("\n"), { mode: 0o600 });
'
}

if [ "$WAS" = "supabase" ]; then
  echo ""
  echo "=== Supabase Service-Role-Schluessel eintragen ==="
  echo ""
  echo "Wo er steht:"
  echo "  https://supabase.com/dashboard/project/zopntlggvtcdwmuvayxs/settings/api-keys"
  echo "  Abschnitt 'Secret keys' -> service_role -> Reveal -> kopieren"
  echo ""
  echo "Dieser Schluessel umgeht jede Rechtepruefung. Er gehoert nur hierher"
  echo "und spaeter in die Vercel-Umgebungsvariablen - nie in den Browser-Code"
  echo "und nie in einen Chat."
  echo ""
  printf "Service-Role-Schluessel: "
  read -rs SB_KEY
  echo ""

  if [ -z "$SB_KEY" ]; then
    echo ""
    echo "Abgebrochen: nichts eingegeben. Nichts geaendert."
    exit 1
  fi

  case "$SB_KEY" in
    sb_secret_*|eyJ*) : ;;
    *) echo ""
       echo "Warnung: das sieht nicht wie ein Service-Role-Schluessel aus."
       echo "Erwartet wird 'sb_secret_...' oder ein JWT, das mit 'eyJ' beginnt."
       printf "Trotzdem speichern? [j/N]: "
       read -r JA
       case "$JA" in j|J|y|Y) : ;; *) echo "Abgebrochen."; exit 1 ;; esac ;;
  esac

  schreibe SUPABASE_SERVICE_ROLE_KEY "$SB_KEY"
  echo ""
  echo "Gespeichert in .env.local (${#SB_KEY} Zeichen)."
  echo ""
  echo "Naechster Schritt - Verbindung zur Datenbank pruefen:"
  echo "  npm run db"
  echo ""
  exit 0
fi

if [ "$WAS" = "smtp" ]; then
  echo ""
  echo "=== SMTP-Postfach eintragen ==="
  echo "Host, Port und Benutzer sind sichtbar, das Passwort nicht."
  echo ""
  ALT_HOST="$(grep '^SMTP_HOST=' .env.local | cut -d= -f2- || true)"
  ALT_USER="$(grep '^SMTP_USER=' .env.local | cut -d= -f2- || true)"
  ALT_PORT="$(grep '^SMTP_PORT=' .env.local | cut -d= -f2- || true)"
  ALT_FROM="$(grep '^SMTP_FROM=' .env.local | cut -d= -f2- || true)"

  printf "SMTP-Host [%s]: " "${ALT_HOST:-mail.example.de}"
  read -r SMTP_HOST
  SMTP_HOST="${SMTP_HOST:-$ALT_HOST}"
  printf "Port [%s]: " "${ALT_PORT:-587}"
  read -r SMTP_PORT
  SMTP_PORT="${SMTP_PORT:-${ALT_PORT:-587}}"
  printf "Benutzer [%s]: " "${ALT_USER:-name@4-wk.de}"
  read -r SMTP_USER
  SMTP_USER="${SMTP_USER:-$ALT_USER}"
  printf "Passwort (unsichtbar): "
  read -rs SMTP_PASS
  echo ""
  printf "Absender [%s]: " "${ALT_FROM:-Aufgabentool 4waendekanzlei <$SMTP_USER>}"
  read -r SMTP_FROM
  SMTP_FROM="${SMTP_FROM:-${ALT_FROM:-Aufgabentool 4waendekanzlei <$SMTP_USER>}}"

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
  echo "Gespeichert (Passwort: ${#SMTP_PASS} Zeichen)."
  echo ""
  echo "Naechster Schritt - anmelden ohne zu senden:"
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
