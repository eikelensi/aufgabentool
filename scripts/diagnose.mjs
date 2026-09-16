/**
 * Diagnose fuer "The HMAC is invalid" (Code 137).
 * Gibt NIEMALS Token oder Secret aus – nur Eigenschaften und Testergebnisse.
 */
import { createHmac, createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");

// Absichtlich roh einlesen, damit Leerzeichen sichtbar werden.
function rawValue(key) {
  for (const line of raw.split("\n")) {
    if (line.startsWith(key + "=")) return line.slice(key.length + 1);
  }
  return null;
}

const TOKEN_RAW = rawValue("ONOFFICE_API_TOKEN");
const SECRET_RAW = rawValue("ONOFFICE_API_SECRET");
const URL_API = (rawValue("ONOFFICE_API_URL") || "https://api.onoffice.de/api/stable/api.php").trim();

if (!TOKEN_RAW || !SECRET_RAW) {
  console.error("Token oder Secret fehlt in .env.local.");
  process.exit(1);
}

function describe(name, v) {
  const trimmed = v.trim();
  const flags = [];
  if (v !== trimmed) flags.push("!! LEERZEICHEN am Anfang/Ende");
  if (/\s/.test(trimmed)) flags.push("!! Leerzeichen MITTENDRIN");
  if (/[\r\n]/.test(v)) flags.push("!! Zeilenumbruch");
  if (/^["'].*["']$/.test(trimmed)) flags.push("!! in Anfuehrungszeichen");
  if (/[^\x20-\x7E]/.test(trimmed)) flags.push("!! ungewoehnliche Zeichen");

  const art = /^[0-9a-f]+$/i.test(trimmed)
    ? "hexadezimal"
    : /^[A-Za-z0-9+/=_-]+$/.test(trimmed)
      ? "base64-artig"
      : "gemischt";

  const fp = createHash("sha256").update(trimmed).digest("hex").slice(0, 8);

  console.log(`  ${name}`);
  console.log(`    Laenge: ${trimmed.length} Zeichen, Art: ${art}, Kennung: ${fp}`);
  console.log(`    ${flags.length ? flags.join(" / ") : "sauber, keine Auffaelligkeiten"}`);
}

const ACTION_READ = "urn:onoffice-de-ns:smart:2.5:smartml:action:read";

async function attempt(label, { token, secret, tsOffset = 0 }) {
  const timestamp = Math.floor(Date.now() / 1000) + tsOffset;
  const resourcetype = "estate";
  const hmac = createHmac("sha256", secret)
    .update(`${timestamp}${token}${resourcetype}${ACTION_READ}`, "utf8")
    .digest("base64");

  const res = await fetch(URL_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      request: {
        actions: [
          {
            actionid: ACTION_READ,
            resourceid: "",
            identifier: "",
            resourcetype,
            timestamp,
            hmac_version: "2",
            hmac,
            parameters: { data: ["Id"], listlimit: 1 },
          },
        ],
      },
    }),
  });

  const serverDate = res.headers.get("date");
  const json = await res.json().catch(() => ({}));
  const st = json?.response?.results?.[0]?.status ?? json?.status ?? {};
  const code = Number(st.errorcode ?? 0);
  const good = res.ok && code === 0;

  console.log(`  ${good ? "TREFFER" : "nein   "}  ${label}${good ? "" : `  (${st.message ?? "HTTP " + res.status}, Code ${code})`}`);
  return { good, serverDate };
}

console.log("\n=== Diagnose Code 137 ===\n");
console.log("1) Wie sehen die Werte aus? (ohne sie zu zeigen)\n");
describe("ONOFFICE_API_TOKEN ", TOKEN_RAW);
describe("ONOFFICE_API_SECRET", SECRET_RAW);

const token = TOKEN_RAW.trim().replace(/^["']|["']$/g, "");
const secret = SECRET_RAW.trim().replace(/^["']|["']$/g, "");

console.log("\n2) Varianten durchprobieren\n");
const a = await attempt("wie eingetragen", { token, secret });
if (!a.good) {
  await attempt("Token und Secret VERTAUSCHT", { token: secret, secret: token });
  await attempt("Zeitstempel -60 s", { token, secret, tsOffset: -60 });
  await attempt("Zeitstempel +60 s", { token, secret, tsOffset: 60 });
}

console.log("\n3) Systemuhr gegen onOffice-Server\n");
if (a.serverDate) {
  const skew = Math.round((Date.now() - new Date(a.serverDate).getTime()) / 1000);
  console.log(`  Abweichung deines Macs: ${skew} Sekunden ${Math.abs(skew) > 30 ? "!! zu gross" : "(unkritisch)"}`);
} else {
  console.log("  Kein Date-Header erhalten.");
}
console.log("");
