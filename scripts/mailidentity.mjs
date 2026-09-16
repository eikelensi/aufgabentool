/**
 * Findet heraus, welche E-Mail-Identitaet der onOffice-API-Benutzer
 * verwenden darf - der Wert fuer ONOFFICE_EMAIL_IDENTITY.
 *
 *   npm run mailidentity deine@adresse.de
 *
 * ACHTUNG: Das Skript versucht echte Mails zu senden, an die von dir
 * angegebene Adresse. Abgelehnte Identitaeten senden nichts; bei der
 * ersten, die onOffice akzeptiert, kommt eine Testmail an und das
 * Skript hoert auf. Es landet also hoechstens eine Mail in deinem Fach.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const val = (k) => { for (const l of raw.split("\n")) if (l.startsWith(k + "=")) return l.slice(k.length + 1).trim(); return ""; };
const TOKEN = val("ONOFFICE_API_TOKEN"), SECRET = val("ONOFFICE_API_SECRET");
const API = val("ONOFFICE_API_URL") || "https://api.onoffice.de/api/stable/api.php";
const A = { get: "urn:onoffice-de-ns:smart:2.5:smartml:action:get", do: "urn:onoffice-de-ns:smart:2.5:smartml:action:do" };

const EMPFAENGER = process.argv[2];
if (!EMPFAENGER || !EMPFAENGER.includes("@")) {
  console.log("\n  Aufruf:  npm run mailidentity deine@adresse.de");
  console.log("  Dorthin geht die Testmail, sobald eine Identitaet passt.\n");
  process.exit(1);
}

async function call(action, resourcetype, parameters = {}, resourceid = "") {
  const timestamp = Math.floor(Date.now() / 1000), actionid = A[action];
  const hmac = createHmac("sha256", SECRET).update(`${timestamp}${TOKEN}${resourcetype}${actionid}`, "utf8").digest("base64");
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: TOKEN, request: { actions: [{ actionid, resourceid, identifier: "", resourcetype, timestamp, hmac_version: "2", hmac, parameters }] } }) });
  const json = await res.json().catch(() => ({}));
  const r = json?.response?.results?.[0] ?? {};
  const st = r.status ?? json?.status ?? {};
  const code = Number(st.errorcode ?? 0);
  if (!res.ok || code !== 0) throw new Error(`${st.message ?? "HTTP " + res.status} (Code ${code})`);
  return r?.data?.records ?? [];
}
const el = (r) => r.elements ?? r;

console.log("\n=== E-Mail-Identitaet suchen ===\n");

// Kandidaten: die Adressen der onOffice-Benutzer plus die ueblichen Sammelpostfaecher
const kandidaten = [];
try {
  const recs = await call("get", "users", { data: ["Vorname", "Name", "email", "Kuerzel"] });
  for (const r of recs) {
    const mail = String(el(r).email ?? "").trim().toLowerCase();
    if (mail.includes("@")) kandidaten.push(mail);
  }
  console.log(`  ${kandidaten.length} Benutzeradressen aus onOffice gelesen.`);
} catch (e) {
  console.log(`  Benutzerliste nicht lesbar: ${e.message}`);
}

const zusatz = ["info@4-wk.de", "aufgaben@4-wk.de", "kontakt@4-wk.de", "noreply@4-wk.de"];
const liste = [...new Set([EMPFAENGER.toLowerCase(), ...zusatz, ...kandidaten])];
console.log(`  ${liste.length} Kandidaten werden geprueft.\n`);

let treffer = null;
for (const identity of liste) {
  try {
    await call("do", "sendmail", {
      emailidentity: identity,
      receiver: [EMPFAENGER],
      subject: "Aufgabentool: Test der E-Mail-Identitaet",
      body:
        "Diese Mail bestaetigt, dass der Versand ueber die onOffice-Schnittstelle funktioniert.\n\n" +
        `Verwendete Identitaet: ${identity}\n` +
        `Zeitpunkt: ${new Date().toLocaleString("de-DE")}\n\n` +
        "4waendekanzlei Aufgabentool",
    });
    console.log(`  TREFFER   ${identity}`);
    treffer = identity;
    break;
  } catch (e) {
    const m = e.message;
    const kurz = /identity|Identit/i.test(m) ? "Identitaet nicht zugeordnet" : m;
    console.log(`  nein      ${identity.padEnd(34)} ${kurz}`);
  }
}

console.log("");
if (treffer) {
  console.log("  Diesen Wert eintragen - lokal in .env.local und bei Vercel:\n");
  console.log(`      ONOFFICE_EMAIL_IDENTITY=${treffer}\n`);
  console.log(`  Eine Testmail ist an ${EMPFAENGER} unterwegs.\n`);
} else {
  console.log("  Keine Identitaet akzeptiert. Das heisst: im Mandanten ist dem");
  console.log("  API-Benutzer kein Postfach zugeordnet. Das wird in onOffice");
  console.log("  gesetzt unter Extras > Einstellungen > Grundeinstellungen > E-Mail.");
  console.log("  Bis dahin laeuft der Versand ueber SMTP:  npm run zugangsdaten smtp\n");
}
