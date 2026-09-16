/**
 * Probiert systematisch alle plausiblen HMAC-Bildungen durch und meldet,
 * welche der onOffice-Mandant akzeptiert. Gibt keine Zugangsdaten aus.
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
const ACTION = "urn:onoffice-de-ns:smart:2.5:smartml:action:read";
const RT = "estate";

const keys = [
  ["Secret als Text", Buffer.from(SECRET, "utf8")],
  ["Secret hex-dekodiert", /^[0-9a-f]{2,}$/i.test(SECRET) && SECRET.length % 2 === 0
      ? Buffer.from(SECRET, "hex") : null],
];

const payloads = (ts) => [
  ["dokumentiert", `timestamp${ts}token${TOKEN}resourcetype${RT}actionid${ACTION}`],
  ["ohne Bezeichner", `${ts}${TOKEN}${RT}${ACTION}`],
  ["mit identifier", `timestamp${ts}token${TOKEN}resourcetype${RT}actionid${ACTION}identifier`],
  ["alphabetisch", `actionid${ACTION}identifierresourceid resourcetype${RT}timestamp${ts}token${TOKEN}`.replace("resourceid ", "resourceid")],
];

const encodings = [
  ["base64", (h) => h.digest("base64")],
  ["hex", (h) => h.digest("hex")],
];

const urls = [
  ["stable", "https://api.onoffice.de/api/stable/api.php"],
  ["latest", "https://api.onoffice.de/api/latest/api.php"],
];

async function test(url, hmac, version) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: TOKEN,
      request: {
        actions: [{
          actionid: ACTION, resourceid: "", identifier: "", resourcetype: RT,
          timestamp: hmac.ts, hmac_version: version, hmac: hmac.value,
          parameters: { data: ["Id"], listlimit: 1 },
        }],
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  const st = json?.response?.results?.[0]?.status ?? json?.status ?? {};
  const code = Number(st.errorcode ?? 0);
  return { good: res.ok && code === 0, msg: st.message ?? `HTTP ${res.status}`, code };
}

console.log("\n=== HMAC-Varianten ===\n");
let winner = null;

outer:
for (const [urlName, url] of urls) {
  for (const [keyName, key] of keys) {
    if (!key) continue;
    for (const [encName, encode] of encodings) {
      for (const version of ["2", 2]) {
        const ts = Math.floor(Date.now() / 1000);
        for (const [payName, payload] of payloads(ts)) {
          const value = encode(createHmac("sha256", key).update(payload, "utf8"));
          const r = await test(url, { ts, value }, version);
          const label = `${urlName} | ${keyName} | ${encName} | v=${typeof version === "number" ? "Zahl" : "Text"} | ${payName}`;
          if (r.good) {
            console.log(`  TREFFER   ${label}`);
            winner = label;
            break outer;
          }
          if (r.code !== 137) console.log(`  anders    ${label}  -> ${r.msg} (${r.code})`);
        }
      }
    }
  }
}

if (winner) {
  console.log(`\nFunktionierende Kombination:\n  ${winner}\n`);
} else {
  console.log("  Keine der 32 Kombinationen wurde akzeptiert – alle melden Code 137.\n");
  console.log("  Das deutet darauf hin, dass das Secret nicht zu diesem Token gehoert.");
  console.log("  In onOffice beim API-Benutzer ein neues Secret erzeugen und beide Werte");
  console.log("  frisch eintragen: npm run zugangsdaten\n");
}
