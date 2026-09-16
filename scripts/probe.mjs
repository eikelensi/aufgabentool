/**
 * Verbindungstest zur onOffice-API – laeuft ohne Server.
 *
 *   node scripts/probe.mjs            (Aufgaben, Benutzer, Objekte)
 *   node scripts/probe.mjs 12345      (zusaetzlich Dateien der Aufgabe 12345)
 *
 * Liest Token und Secret aus .env.local. Gibt niemals Zugangsdaten aus.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

// --- .env.local einlesen -------------------------------------------------
let env = {};
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch {
  console.error("Keine .env.local gefunden.");
  process.exit(1);
}

const TOKEN = env.ONOFFICE_API_TOKEN;
const SECRET = env.ONOFFICE_API_SECRET;
const URL_API = env.ONOFFICE_API_URL || "https://api.onoffice.de/api/stable/api.php";

if (!TOKEN || !SECRET) {
  console.error("\n  ONOFFICE_API_TOKEN oder ONOFFICE_API_SECRET ist in .env.local noch leer.");
  console.error("  Bitte beide Zeilen ausfuellen und erneut starten.\n");
  process.exit(1);
}

const ACTION = {
  read: "urn:onoffice-de-ns:smart:2.5:smartml:action:read",
  get: "urn:onoffice-de-ns:smart:2.5:smartml:action:get",
};

async function call(action, resourcetype, parameters = {}, resourceid = "") {
  const timestamp = Math.floor(Date.now() / 1000);
  const actionid = ACTION[action];
  const hmac = createHmac("sha256", SECRET)
    .update(`${timestamp}${TOKEN}${resourcetype}${actionid}`, "utf8")
    .digest("base64");

  const res = await fetch(URL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: TOKEN,
      request: {
        actions: [
          { actionid, resourceid, identifier: "", resourcetype, timestamp, hmac_version: "2", hmac, parameters },
        ],
      },
    }),
  });

  const json = await res.json().catch(() => ({}));
  const result = json?.response?.results?.[0] ?? {};
  const status = result.status ?? json?.status ?? {};
  const code = Number(status.errorcode ?? 0);

  if (!res.ok || code !== 0) {
    throw new Error(`${status.message ?? "HTTP " + res.status} (Code ${code})`);
  }
  return { records: result?.data?.records ?? [], total: result?.data?.meta?.cntabsolute };
}

const el = (r) => r.elements ?? r;
const ok = (s) => `  OK    ${s}`;
const no = (s) => `  FEHLT ${s}`;

console.log("\n=== onOffice-Verbindungstest ===\n");

// 1) Aufgaben
let taskId = process.argv[2];
try {
  const { records, total } = await call("read", "task", {
    data: ["Nr", "Betreff", "Status", "Prio", "Bearbeiter", "Verantwortung", "Deadline", "Beginnt_am"],
    listlimit: 50,
  });
  const status = [...new Set(records.map((r) => String(el(r).Status ?? "")))].filter(Boolean).sort();
  const prio = [...new Set(records.map((r) => String(el(r).Prio ?? "")))].filter(Boolean).sort();
  const bearb = [...new Set(records.map((r) => String(el(r).Bearbeiter ?? "")))].filter(Boolean).sort();

  console.log(ok(`Aufgaben lesen: ${records.length} von ${total ?? "?"}`));
  console.log(`        Status-Werte im Mandanten : ${status.join(", ") || "keine"}`);
  console.log(`        Prio-Werte im Mandanten   : ${prio.join(", ") || "keine"}`);
  console.log(`        Bearbeiter                : ${bearb.slice(0, 12).join(" | ") || "keine"}`);
  taskId = taskId ?? String(records[0]?.id ?? el(records[0] ?? {}).Nr ?? "");
} catch (e) {
  console.log(no(`Aufgaben lesen: ${e.message}`));
}

// 2) Benutzer
let userResource = null;
for (const rt of ["user", "users"]) {
  try {
    const { records } = await call("get", rt, { data: ["Vorname", "Name", "email", "Kuerzel", "aktiv"] });
    const withMail = records.filter((r) => String(el(r).email ?? "").includes("@"));
    console.log(ok(`Benutzerliste ueber resourcetype "${rt}": ${records.length} Eintraege, ${withMail.length} mit E-Mail`));
    userResource = rt;
    break;
  } catch (e) {
    if (rt === "users") console.log(no(`Benutzerliste: ${e.message}`));
  }
}

// 3) Objekte
try {
  await call("read", "estate", { data: ["Id", "objektnr_extern"], listlimit: 1 });
  console.log(ok("Objekte lesen (estate)"));
} catch (e) {
  console.log(no(`Objekte lesen: ${e.message}`));
}

// 4) Der entscheidende Test: Dateien einer Aufgabe
if (taskId) {
  const variants = [
    ["taskid", { taskid: Number(taskId) }],
    ["recordid", { recordid: Number(taskId) }],
    ["parentid", { parentid: Number(taskId) }],
  ];
  let worked = false;
  for (const [name, params] of variants) {
    try {
      const { records } = await call("get", "file", params, "task");
      console.log(ok(`Aufgaben-DATEIEN lesen ueber "${name}": ${records.length} Datei(en) an Aufgabe ${taskId}`));
      for (const r of records.slice(0, 5)) {
        const e = el(r);
        console.log(`        - ${e.filename ?? e.originalname ?? "?"} (${e.fileSize ?? "?"} Bytes)`);
      }
      worked = true;
      break;
    } catch (e) {
      console.log(`  ..    Variante "${name}": ${e.message}`);
    }
  }
  if (!worked) {
    console.log(no("Aufgaben-Dateien lesen – kein Weg gefunden. Rueckweg aus onOffice nicht moeglich."));
  }
} else {
  console.log(no("Aufgaben-Dateien: keine Aufgaben-ID. Bitte 'node scripts/probe.mjs <Nr>' mit einer Aufgabe mit Anhang."));
}

console.log("\nDieser Bericht enthaelt keine Zugangsdaten und kann weitergegeben werden.\n");
