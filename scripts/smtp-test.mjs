/**
 * SMTP-Postfach pruefen.
 *
 *   npm run smtp                      – nur Verbindung und Anmeldung
 *   npm run smtp name@4-wk.de         – zusaetzlich eine Testmail dorthin
 *
 * Liest die Werte aus .env.local. Gibt das Passwort nie aus.
 */
import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const val = (k) => {
  for (const l of raw.split("\n")) if (l.startsWith(k + "=")) return l.slice(k.length + 1).trim();
  return "";
};

const host = val("SMTP_HOST");
const port = Number(val("SMTP_PORT") || 587);
const user = val("SMTP_USER");
const pass = val("SMTP_PASS");
const from = val("SMTP_FROM") || user;

console.log("\n=== SMTP-Test ===\n");

if (!host || !user || !pass) {
  console.log("  Es fehlen Werte in .env.local.");
  console.log("  Bitte eintragen mit:  npm run zugangsdaten smtp\n");
  process.exit(1);
}

console.log(`  Host     : ${host}`);
console.log(`  Port     : ${port} (${port === 465 ? "direktes TLS" : "STARTTLS"})`);
console.log(`  Benutzer : ${user}`);
console.log(`  Absender : ${from}`);
console.log(`  Passwort : ${"*".repeat(Math.min(pass.length, 12))} (${pass.length} Zeichen)\n`);

const transport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  requireTLS: port !== 465,
  auth: { user, pass },
  connectionTimeout: 15_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

try {
  await transport.verify();
  console.log("  OK  Verbindung und Anmeldung erfolgreich.");
} catch (err) {
  console.log(`  FEHLER  ${err.message}`);
  const m = String(err.message).toLowerCase();
  if (m.includes("auth")) {
    console.log("\n  Anmeldung abgelehnt. Haeufige Ursachen:");
    console.log("    - Benutzername ist nicht die Mailadresse, sondern eine Kennung");
    console.log("    - der Anbieter verlangt ein eigenes App-Passwort");
    console.log("    - SMTP-Versand ist fuer das Postfach nicht freigeschaltet");
  } else if (m.includes("timeout") || m.includes("econnrefused")) {
    console.log("\n  Keine Verbindung. Port 587 und 465 einmal tauschen:");
    console.log("    npm run zugangsdaten smtp");
  } else if (m.includes("certificate") || m.includes("self signed")) {
    console.log("\n  Zertifikatsproblem – bitte den Hostnamen genau so eintragen,");
    console.log("  wie der Anbieter ihn nennt (nicht die eigene Domain).");
  }
  console.log("");
  process.exit(1);
}

const to = process.argv[2];
if (!to) {
  console.log("\n  Fuer eine echte Testmail:  npm run smtp deine@adresse.de\n");
  process.exit(0);
}

try {
  const info = await transport.sendMail({
    from,
    to,
    subject: "Testmail aus dem Aufgabentool",
    text:
      "Diese Mail bestaetigt, dass der SMTP-Versand funktioniert.\n\n" +
      `Gesendet am ${new Date().toLocaleString("de-DE")}\n\n` +
      "4waendekanzlei Aufgabentool",
  });
  console.log(`  OK  Mail an ${to} versendet. Message-ID: ${info.messageId}`);
  if (info.rejected?.length) console.log(`  Abgewiesen: ${info.rejected.join(", ")}`);
  console.log("");
} catch (err) {
  console.log(`  FEHLER beim Senden: ${err.message}\n`);
  process.exit(1);
}
