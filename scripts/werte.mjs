/**
 * Ermittelt Auswahlwerte, neueste Aufgaben und die Verknuepfungen einer
 * Aufgabe. Zeigt Rohstrukturen, wo die Form unklar ist.
 *
 *   npm run werte            – sucht sich selbst eine aktuelle Aufgabe
 *   npm run werte 987654     – nimmt diese Aufgabennummer
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

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
const cut = (o, n = 900) => { const s = JSON.stringify(o); return s.length > n ? s.slice(0, n) + " …" : s; };

// ---------------------------------------------------------------- 1
console.log("\n=== 1) Auswahlwerte: Rohdefinition von Status, Prio, Art ===\n");
try {
  const recs = await call("get", "fields", { modules: ["task"], labels: true });
  for (const rec of recs) {
    for (const [field, def] of Object.entries(el(rec))) {
      if (!["Status", "Prio", "Art"].includes(field)) continue;
      console.log(`  ${field}:`);
      console.log(`    ${cut(def)}\n`);
    }
  }
} catch (e) { console.log(`  FEHLER: ${e.message}\n`); }

// ---------------------------------------------------------------- 2
console.log("=== 2) Aktuelle Aufgaben (ueber Filter auf modified) ===\n");
let candidate = process.argv[2];
try {
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const recs = await call("read", "task", {
    data: ["Betreff", "Status", "Prio", "Art", "Bearbeiter", "Verantwortung", "Deadline", "modified", "hochgeladenAm"],
    filter: { modified: [{ op: ">=", val: since }] },
    listlimit: 25,
  });
  console.log(`  ${recs.length} Aufgaben seit ${since}`);
  const uniq = (f) => [...new Set(recs.map((r) => String(el(r)[f] ?? "").trim()))].filter(Boolean);
  console.log(`  Status live : ${uniq("Status").join(" | ") || "-"}`);
  console.log(`  Prio live   : ${uniq("Prio").sort().join(", ") || "-"}`);
  console.log(`  Art live    : ${uniq("Art").join(", ") || "-"}`);
  const mitUpload = recs.filter((r) => { const v = String(el(r).hochgeladenAm ?? "").trim(); return v && !v.startsWith("0000"); });
  console.log(`  mit hochgeladenAm : ${mitUpload.length}  ${mitUpload.length ? "<- diese haben Dateien" : ""}`);
  console.log("");
  for (const r of recs.slice(0, 8)) {
    const e = el(r);
    console.log(`    id=${String(r.id).padEnd(8)} ${String(e.Status).padEnd(16)} Prio=${String(e.Prio).padEnd(3)} ${String(e.Betreff).slice(0, 38)}`);
  }
  // Bevorzugt eine Aufgabe mit Datei-Upload als Testkandidat
  candidate = candidate || String((mitUpload[0] ?? recs[0])?.id ?? "");
} catch (e) { console.log(`  FEHLER: ${e.message}`); }

// ---------------------------------------------------------------- 3
if (candidate) {
  console.log(`\n=== 3) Verknuepfungen der Aufgabe ${candidate} ===\n`);
  for (const kind of ["estate", "address"]) {
    const relationtype = `urn:onoffice-de-ns:smart:2.5:relationTypes:task:${kind}`;
    try {
      const recs = await call("get", "idsfromrelation", { relationtype, parentids: [String(candidate)] });
      console.log(`  ${kind}  Rohantwort: ${cut(recs, 400)}`);

      // Verknuepfte IDs sauber herausziehen: die Werte unter der Eltern-ID
      const ids = new Set();
      for (const rec of recs) {
        for (const [parent, children] of Object.entries(el(rec))) {
          if (parent === String(candidate) || true) {
            for (const c of [].concat(children ?? [])) {
              const s = String(c).trim();
              if (s && s !== String(candidate)) ids.add(s);
            }
          }
        }
      }
      console.log(`  ${kind}  verknuepfte IDs: ${[...ids].join(", ") || "keine"}`);

      for (const id of [...ids].slice(0, 3)) {
        try {
          const files = await call("get", "file", kind === "estate" ? { estateid: Number(id) } : { addressid: Number(id) }, kind);
          console.log(`        ${kind} ${id}: ${files.length} Datei(en)`);
          for (const f of files.slice(0, 6)) {
            const e = el(f);
            console.log(`          - ${e.filename ?? e.originalname ?? "?"}  ${e.fileSize ?? "?"} B  Art=${e.type ?? "?"}`);
          }
        } catch (e) { console.log(`        ${kind} ${id}: ${e.message}`); }
      }
    } catch (e) {
      console.log(`  ${kind}  FEHLER: ${e.message}`);
    }
    console.log("");
  }
}
console.log("");
