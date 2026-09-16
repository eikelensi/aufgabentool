/**
 * Fragt die echte Feldkonfiguration des Mandanten ab und testet, welche
 * Datei-Zugaenge es gibt. Gibt keine Zugangsdaten aus.
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

const A = {
  read: "urn:onoffice-de-ns:smart:2.5:smartml:action:read",
  get: "urn:onoffice-de-ns:smart:2.5:smartml:action:get",
};

async function call(action, resourcetype, parameters = {}, resourceid = "") {
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
      request: { actions: [{ actionid, resourceid, identifier: "", resourcetype, timestamp, hmac_version: "2", hmac, parameters }] },
    }),
  });
  const json = await res.json().catch(() => ({}));
  const r = json?.response?.results?.[0] ?? {};
  const st = r.status ?? json?.status ?? {};
  const code = Number(st.errorcode ?? 0);
  if (!res.ok || code !== 0) throw new Error(`${st.message ?? "HTTP " + res.status} (Code ${code})`);
  return r?.data?.records ?? [];
}

const el = (r) => r.elements ?? r;

console.log("\n=== Feldkonfiguration Modul \"task\" ===\n");
let taskFields = [];
try {
  const recs = await call("get", "fields", { modules: ["task"], labels: true });
  for (const rec of recs) {
    const e = el(rec);
    for (const [name, def] of Object.entries(e)) {
      if (name === "modul" || typeof def !== "object" || def === null) continue;
      taskFields.push(name);
    }
  }
  console.log(`  ${taskFields.length} Felder:\n`);
  for (let i = 0; i < taskFields.length; i += 6) {
    console.log("    " + taskFields.slice(i, i + 6).join(", "));
  }
} catch (e) {
  console.log(`  FEHLER: ${e.message}`);
}

console.log("\n=== Aufgaben lesen mit echten Feldern ===\n");
const wanted = ["Betreff", "Aufgabe", "Status", "Prio", "Bearbeiter", "Verantwortung", "Deadline", "Beginnt_am", "Art", "Privat"];
const use = taskFields.length ? wanted.filter((f) => taskFields.includes(f)) : wanted;
console.log(`  Angefragt: ${use.join(", ")}\n`);
try {
  const recs = await call("read", "task", { data: use, listlimit: 50 });
  const uniq = (f) => [...new Set(recs.map((r) => String(el(r)[f] ?? "")))].filter(Boolean).sort();
  console.log(`  OK  ${recs.length} Aufgaben gelesen`);
  console.log(`      Status-Werte : ${uniq("Status").join(", ") || "-"}`);
  console.log(`      Prio-Werte   : ${uniq("Prio").join(", ") || "-"}`);
  console.log(`      Art-Werte    : ${uniq("Art").slice(0, 10).join(", ") || "-"}`);
  console.log(`      Bearbeiter   : ${uniq("Bearbeiter").slice(0, 10).join(" | ") || "-"}`);
  const first = recs[0];
  if (first) {
    console.log(`\n      Beispiel-Aufgabe id=${first.id ?? "?"}:`);
    for (const [k, v] of Object.entries(el(first))) console.log(`        ${k} = ${String(v).slice(0, 60)}`);
  }
} catch (e) {
  console.log(`  FEHLER: ${e.message}`);
}

console.log("\n=== Welche Datei-Zugaenge gibt es? ===\n");
for (const [label, rid, params] of [
  ["file + estate (dokumentiert)", "estate", { estateid: 1 }],
  ["file + address", "address", { addressid: 1 }],
  ["file + agentsLog", "agentsLog", { agentsLogId: 1 }],
  ["file + task", "task", { taskid: 1 }],
  ["fileRelation lesen", "", { relationtype: "task", parentid: 1 }],
]) {
  try {
    await call("get", rid ? "file" : "fileRelation", params, rid);
    console.log(`  MOEGLICH   ${label}`);
  } catch (e) {
    const m = e.message;
    const verdict = /missing configuration/.test(m) ? "NICHT VORHANDEN" : "vorhanden, anderer Fehler";
    console.log(`  ${verdict.padEnd(10)} ${label}  -> ${m}`);
  }
}
console.log("");
