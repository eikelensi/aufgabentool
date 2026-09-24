/**
 * Aufgaben in onOffice schliessen - fuer Versehen und Testeintraege.
 *
 *   node scripts/aufraeumen-proben.mjs 31893 31895            (nur anzeigen)
 *   node scripts/aufraeumen-proben.mjs 31893 31895 --wirklich (schliessen)
 *
 * Geloescht wird nichts: die Aufgabe bekommt einen klaren Titel, keinen
 * Bearbeiter und den Status "Erledigt". Wer sie ganz weghaben will,
 * entfernt sie in onOffice von Hand - das kann diese Schnittstelle nicht,
 * und es soll auch kein Skript nebenbei tun.
 *
 * Braucht eine Verbindung zu api.onoffice.de. Aus einer abgeschotteten
 * Umgebung heraus laeuft es nicht (EAI_AGAIN) - dann auf dem Rechner
 * starten, auf dem auch npm run dev laeuft.
 */
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}

const TOKEN = env.ONOFFICE_API_TOKEN;
const SECRET = env.ONOFFICE_API_SECRET;
const URL_API = env.ONOFFICE_API_URL || "https://api.onoffice.de/api/stable/api.php";
const NR = process.argv.slice(2).filter((a) => /^\d+$/.test(a));

if (!NR.length) {
  console.error("\n  Keine Aufgabennummer angegeben.\n  node scripts/aufraeumen-proben.mjs 31893 31895 [--wirklich]\n");
  process.exit(1);
}
const WIRKLICH = process.argv.includes("--wirklich");

const ACTION = {
  read: "urn:onoffice-de-ns:smart:2.5:smartml:action:read",
  modify: "urn:onoffice-de-ns:smart:2.5:smartml:action:modify",
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
  const r = json?.response?.results?.[0] ?? {};
  if (Number(r.status?.errorcode ?? 0) !== 0) {
    throw new Error(`${r.status?.message} (Code ${r.status?.errorcode})`);
  }
  return r.data?.records ?? [];
}

for (const id of NR) {
  const [rec] = await call("read", "task", {
    recordids: [Number(id)],
    data: ["Name", "Status", "Bearbeiter"],
  });
  const e = rec?.elements ?? {};
  console.log(`\nAufgabe ${id}: "${e.Name ?? "?"}" · Status ${e.Status ?? "?"} · Bearbeiter ${e.Bearbeiter ?? "-"}`);

  if (!WIRKLICH) {
    console.log("  (nur angezeigt - mit --wirklich schliessen)");
    continue;
  }

  await call("modify", "task", {
    data: {
      Name: "Testeintrag (versehentlich angelegt) - kann geloescht werden",
      Status: env.ONOFFICE_STATUS_ERLEDIGT ?? "3",
      Bearbeiter: "",
    },
  }, id);
  console.log("  → umbenannt und auf Erledigt gesetzt.");
}
