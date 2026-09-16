/**
 * Misst, welche Stammdaten die onOffice-Benutzerliste des Mandanten
 * hergibt - insbesondere Telefon, Durchwahl und Standort.
 *
 *   npm run kollegen          Feldnamen, Befuellungsgrad, ein Beispiel gekuerzt
 *   npm run kollegen voll     zusaetzlich alle Benutzer mit allen Werten
 *
 * Ohne "voll" werden Werte gekuerzt ausgegeben: der Bericht laesst sich
 * dann weitergeben, ohne die Telefonnummern aller Kollegen zu verteilen.
 * Gibt niemals Token oder Secret aus.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const val = (k) => {
  for (const l of raw.split("\n")) if (l.startsWith(k + "=")) return l.slice(k.length + 1).trim();
  return "";
};
const TOKEN = val("ONOFFICE_API_TOKEN");
const SECRET = val("ONOFFICE_API_SECRET");
const API = val("ONOFFICE_API_URL") || "https://api.onoffice.de/api/stable/api.php";

if (!TOKEN || !SECRET) {
  console.log("\n  Token oder Secret fehlt in .env.local.\n  npm run zugangsdaten\n");
  process.exit(1);
}

const VOLL = process.argv.slice(2).some((a) => /^(voll|full|alles)$/i.test(a));

const A = {
  read: "urn:onoffice-de-ns:smart:2.5:smartml:action:read",
  get: "urn:onoffice-de-ns:smart:2.5:smartml:action:get",
};

async function call(action, resourcetype, parameters = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const actionid = A[action];
  const hmac = createHmac("sha256", SECRET)
    .update(`${timestamp}${TOKEN}${resourcetype}${actionid}`, "utf8")
    .digest("base64");
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: TOKEN,
      request: {
        actions: [
          {
            actionid,
            resourceid: "",
            identifier: "",
            resourcetype,
            timestamp,
            hmac_version: "2",
            hmac,
            parameters,
          },
        ],
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  const r = json?.response?.results?.[0] ?? {};
  const st = r.status ?? json?.status ?? {};
  const code = Number(st.errorcode ?? 0);
  if (!res.ok || code !== 0) {
    throw new Error(`${st.message ?? "HTTP " + res.status} (Code ${code})`);
  }
  return r?.data?.records ?? [];
}

const el = (r) => r.elements ?? r;
const kurz = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (VOLL) return s;
  if (s.length <= 4) return s[0] + "…";
  return s.slice(0, 4) + "…" + `(${s.length})`;
};

console.log("\n=== onOffice-Benutzerliste: was kommt an? ===\n");
if (!VOLL) console.log("  Werte gekuerzt. Fuer alles:  npm run kollegen voll\n");

// ---------------------------------------------------------------
// 1) Welche Ressource antwortet ueberhaupt?
// ---------------------------------------------------------------
let ressource = "";
for (const kandidat of ["users", "user"]) {
  try {
    await call("read", kandidat, { listlimit: 1 });
    ressource = kandidat;
    console.log(`  Ressource : "${kandidat}" antwortet.`);
    break;
  } catch (e) {
    console.log(`  Ressource : "${kandidat}" - ${e.message}`);
  }
}
if (!ressource) {
  console.log("\n  Keine Benutzerressource erreichbar. Abbruch.\n");
  process.exit(1);
}

// ---------------------------------------------------------------
// 2) Feldkonfiguration befragen
// ---------------------------------------------------------------
console.log("\n--- Feldkonfiguration ---");
let felderAusKonfig = [];
for (const modul of ["user", "users", "benutzer"]) {
  try {
    const recs = await call("get", "fields", { modules: [modul], labels: true });
    const namen = [];
    for (const rec of recs) {
      for (const [name, def] of Object.entries(el(rec))) {
        if (name === "modul" || typeof def !== "object" || def === null) continue;
        namen.push(name);
      }
    }
    if (namen.length) {
      felderAusKonfig = namen;
      console.log(`  Modul "${modul}": ${namen.length} Felder`);
      for (let i = 0; i < namen.length; i += 5) {
        console.log("    " + namen.slice(i, i + 5).join(", "));
      }
      break;
    }
    console.log(`  Modul "${modul}": keine Felder gemeldet`);
  } catch (e) {
    console.log(`  Modul "${modul}": ${e.message}`);
  }
}

// ---------------------------------------------------------------
// 3) Kandidaten einzeln testen - die Konfiguration nennt oft mehr,
//    als der Lesecall annimmt (wie bei task).
// ---------------------------------------------------------------
const KANDIDATEN = [
  // Person
  "Vorname", "Nachname", "Name", "Anrede", "Titel", "Kuerzel", "Benutzername",
  "login", "Benutzer", "Mitarbeiter",
  // Erreichbarkeit - darum geht es hier
  "EMail", "Email", "email", "EMailAdresse",
  "Telefon", "Telefon1", "Telefonnummer", "Telefon_Zentrale", "Rufnummer",
  "Durchwahl", "Telefon_Durchwahl", "Nebenstelle",
  "Mobil", "Mobiltelefon", "Handy", "Fax",
  // Organisation
  "Standort", "Buero", "Niederlassung", "Filiale", "Abteilung", "Position",
  "Funktion", "Gruppe", "Rolle",
  // Adresse
  "Strasse", "Hausnummer", "PLZ", "Ort", "Land",
  // Status
  "Aktiv", "aktiv", "Status", "Gesperrt",
];

const zuTesten = [...new Set([...felderAusKonfig, ...KANDIDATEN])];
console.log(`\n--- Feldtest (${zuTesten.length} Kandidaten, einzeln) ---`);

const akzeptiert = [];
const abgelehnt = [];
for (const feld of zuTesten) {
  try {
    await call("read", ressource, { data: [feld], listlimit: 1 });
    akzeptiert.push(feld);
  } catch (e) {
    abgelehnt.push(feld);
  }
}
console.log(`  angenommen (${akzeptiert.length}): ${akzeptiert.join(", ") || "-"}`);
console.log(`  abgelehnt  (${abgelehnt.length}): ${abgelehnt.join(", ") || "-"}`);

if (!akzeptiert.length) {
  console.log("\n  Kein einziges Feld angenommen. Abbruch.\n");
  process.exit(1);
}

// ---------------------------------------------------------------
// 4) Alle Benutzer mit den angenommenen Feldern lesen
// ---------------------------------------------------------------
console.log("\n--- Befuellungsgrad ---");
let benutzer = [];
try {
  benutzer = await call("read", ressource, { data: akzeptiert, listlimit: 200 });
} catch (e) {
  console.log(`  Sammelabruf fehlgeschlagen: ${e.message}`);
  process.exit(1);
}
console.log(`  ${benutzer.length} Benutzer gelesen.\n`);

const breite = Math.max(...akzeptiert.map((f) => f.length));
for (const feld of akzeptiert) {
  const werte = benutzer.map((b) => String(el(b)[feld] ?? "").trim()).filter(Boolean);
  const anteil = benutzer.length ? Math.round((werte.length / benutzer.length) * 100) : 0;
  const marke = anteil === 100 ? "OK  " : anteil >= 50 ? "teil" : anteil > 0 ? "kaum" : "leer";
  const beispiel = werte[0] ? `  z.B. ${kurz(werte[0])}` : "";
  console.log(
    `  ${marke}  ${feld.padEnd(breite)}  ${String(anteil).padStart(3)}% ` +
      `(${werte.length}/${benutzer.length})${beispiel}`,
  );
}

// ---------------------------------------------------------------
// 5) Fazit fuer die Mitarbeiterverwaltung
// ---------------------------------------------------------------
const finde = (...kandidaten) => kandidaten.find((k) => akzeptiert.includes(k));
const gefuellt = (feld) =>
  feld ? benutzer.some((b) => String(el(b)[feld] ?? "").trim()) : false;

const brauchen = [
  ["E-Mail", finde("EMail", "Email", "email", "EMailAdresse")],
  ["Telefon", finde("Telefon", "Telefon1", "Telefonnummer", "Rufnummer", "Telefon_Zentrale")],
  ["Durchwahl", finde("Durchwahl", "Telefon_Durchwahl", "Nebenstelle")],
  ["Standort", finde("Standort", "Buero", "Niederlassung", "Filiale")],
];

console.log("\n--- Fazit fuer die Mitarbeiterverwaltung ---\n");
for (const [zweck, feld] of brauchen) {
  if (!feld) {
    console.log(`  ${zweck.padEnd(10)} kein passendes Feld -> von Hand pflegen`);
  } else if (!gefuellt(feld)) {
    console.log(`  ${zweck.padEnd(10)} Feld "${feld}" existiert, ist aber leer -> von Hand pflegen`);
  } else {
    console.log(`  ${zweck.padEnd(10)} kommt aus "${feld}" -> synchronisierbar`);
  }
}

if (VOLL) {
  console.log("\n--- Alle Benutzer ---\n");
  for (const b of benutzer) {
    const e = el(b);
    console.log(`  id=${b.id ?? "?"}`);
    for (const feld of akzeptiert) {
      const v = String(e[feld] ?? "").trim();
      if (v) console.log(`    ${feld.padEnd(breite)} = ${v}`);
    }
    console.log("");
  }
}

console.log("\n  Dieser Bericht enthaelt keine Zugangsdaten.\n");
