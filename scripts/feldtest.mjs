/**
 * Testet jedes Feld des Aufgabenmoduls einzeln, baut daraus die gueltige
 * Feldliste und liest damit aktuelle Aufgaben. Prueft zuletzt, ob Anhaenge
 * ueber verknuepfte Objekte oder Adressen erreichbar sind.
 */
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const val = (k) => { for (const l of raw.split("\n")) if (l.startsWith(k + "=")) return l.slice(k.length + 1).trim(); return ""; };
const TOKEN = val("ONOFFICE_API_TOKEN"), SECRET = val("ONOFFICE_API_SECRET");
const API = val("ONOFFICE_API_URL") || "https://api.onoffice.de/api/stable/api.php";
const A = { read: "urn:onoffice-de-ns:smart:2.5:smartml:action:read", get: "urn:onoffice-de-ns:smart:2.5:smartml:action:get" };

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

const ALL = ["Nr","Verantwortung","Betreff","Status","Eintragsdatum","Art","von","Bearbeiter","Prio",
  "Deadline","Aufgabe","newValue","Privat","Erinnerung","Erinnerungsdatum","hochgeladenAm",
  "Beginnt_am","modified","Deadline_strikt","Deadline_Zeit","Beginnt_um","tags"];

console.log("\n=== 1) Welche Felder nimmt die Leseabfrage an? ===\n");
const good = [], bad = [];
for (const f of ALL) {
  try { await call("read", "task", { data: [f], listlimit: 1 }); good.push(f); }
  catch { bad.push(f); }
}
console.log(`  ANGENOMMEN (${good.length}):\n    ${good.join(", ")}\n`);
console.log(`  ABGELEHNT  (${bad.length}):\n    ${bad.join(", ") || "-"}\n`);

console.log("=== 2) Aktuelle Aufgaben mit der gueltigen Feldliste ===\n");
let candidate = process.argv[2] || "";
try {
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const recs = await call("read", "task", {
    data: good,
    filter: { modified: [{ op: ">=", val: since }] },
    listlimit: 25,
  });
  const uniq = (f) => [...new Set(recs.map((r) => String(el(r)[f] ?? "").trim()))].filter(Boolean);
  console.log(`  ${recs.length} Aufgaben seit ${since}`);
  console.log(`  Status live : ${uniq("Status").join(" | ") || "-"}`);
  console.log(`  Prio  live : ${uniq("Prio").sort().join(", ") || "-"}`);
  console.log(`  Art   live : ${uniq("Art").join(", ") || "-"}`);
  console.log(`  Bearbeiter : ${uniq("Bearbeiter").slice(0, 8).join(" | ") || "-"}\n`);
  for (const r of recs.slice(0, 8)) {
    const e = el(r);
    console.log(`    id=${String(r.id).padEnd(8)} ${String(e.Status).padEnd(16)} Prio=${String(e.Prio).padEnd(3)} ${String(e.Betreff).slice(0, 36)}`);
  }
  candidate = candidate || String(recs[0]?.id ?? "");
  writeFileSync("scripts/.felder.json", JSON.stringify(good, null, 2));
} catch (e) { console.log(`  FEHLER: ${e.message}`); }

if (candidate) {
  console.log(`\n=== 3) Anhaenge ueber Verknuepfungen der Aufgabe ${candidate} ===\n`);
  for (const kind of ["estate", "address"]) {
    try {
      const recs = await call("get", "idsfromrelation", {
        relationtype: `urn:onoffice-de-ns:smart:2.5:relationTypes:task:${kind}`,
        parentids: [String(candidate)],
      });
      const ids = new Set();
      for (const rec of recs) for (const v of Object.values(el(rec))) for (const c of [].concat(v ?? [])) {
        const s = String(c).trim(); if (s && /^\d+$/.test(s)) ids.add(s);
      }
      console.log(`  ${kind}: ${[...ids].join(", ") || "keine Verknuepfung"}`);
      for (const id of [...ids].slice(0, 2)) {
        try {
          const files = await call("get", "file", kind === "estate" ? { estateid: Number(id) } : { addressid: Number(id) }, kind);
          console.log(`      ${id}: ${files.length} Datei(en)`);
          for (const f of files.slice(0, 6)) {
            const e = el(f);
            console.log(`        - ${e.filename ?? e.originalname ?? "?"}  ${e.fileSize ?? "?"} B`);
          }
        } catch (e) { console.log(`      ${id}: ${e.message}`); }
      }
    } catch (e) { console.log(`  ${kind}: ${e.message}`); }
  }
}
console.log("");
