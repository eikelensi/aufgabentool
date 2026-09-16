#!/usr/bin/env bash
# Prueft das GitHub-Token, legt es in den Schluesselbund und pusht.
set -uo pipefail
cd "$(dirname "$0")/.."

OWNER="eikelensi"
REPO="aufgabentool"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo ""
echo "=== Push nach $OWNER/$REPO ($BRANCH) === [Fassung 2]"
echo ""
printf "Token (unsichtbar): "
read -rs GH_TOKEN
echo ""

if [ ${#GH_TOKEN} -eq 0 ]; then echo "Nichts eingegeben. Abgebrochen."; exit 1; fi

echo ""
echo "--- 1) Gueltigkeit ---"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" https://api.github.com/user)
[ "$CODE" = "200" ] && echo "    OK  Token gueltig (${#GH_TOKEN} Zeichen)" || { echo "    FEHLER HTTP $CODE"; exit 1; }

echo ""
echo "--- 2) Schreibrecht auf $REPO ---"
PERM=$(curl -s -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$OWNER/$REPO" | tr -d ' \n' | grep -o '"push":\(true\|false\)' | head -1)
[ "$PERM" = '"push":true' ] && echo "    OK  darf schreiben" || { echo "    FEHLER  $PERM"; exit 1; }

echo ""
echo "--- 3) Anmeldung in den Schluesselbund ---"
HELPER="$(git config --global --get credential.helper || true)"
if [ -z "$HELPER" ]; then
  git config --global credential.helper osxkeychain
  echo "    credential.helper auf osxkeychain gesetzt"
else
  echo "    credential.helper: $HELPER"
fi

printf "protocol=https\nhost=github.com\n\n" | git credential reject 2>/dev/null || true
printf "protocol=https\nhost=github.com\nusername=%s\n\n" "$OWNER" | git credential reject 2>/dev/null || true

if printf "protocol=https\nhost=github.com\nusername=%s\npassword=%s\n\n" "$OWNER" "$GH_TOKEN" \
     | git credential approve 2>/dev/null; then
  echo "    Token hinterlegt"
else
  echo "    Konnte nicht hinterlegt werden - Git fragt beim Push"
fi

echo ""
echo "--- 4) Push ---"
git remote set-url origin "https://github.com/$OWNER/$REPO.git"

if git push -u origin "$BRANCH"; then
  echo ""
  echo "    OK  Gepusht. Kuenftig reicht:  git push"
  unset GH_TOKEN
else
  echo ""
  echo "    Fehlgeschlagen. Wenn Git nach Benutzer/Passwort fragt:"
  echo "    Benutzer: $OWNER    Passwort: das Token"
  unset GH_TOKEN
  exit 1
fi
echo ""
