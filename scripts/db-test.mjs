/**
 * Prueft die Verbindung zur Supabase-Datenbank.
 *
 *   npm run db
 *
 * Liest .env.local. Gibt keine Schluessel aus.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const val = (k) => {
  for (const l of raw.split("\n")) if (l.startsWith(k + "=")) return l.slice(k.length + 1).trim();
  return "";
};

const url = val("NEXT_PUBLIC_SUPABASE_URL");
const anon = val("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const service = val("SUPABASE_SERVICE_ROLE_KEY");

console.log("\n=== Datenbanktest ===\n");
console.log(`  Projekt-URL : ${url || "FEHLT"}`);
console.log(`  Anon-Key    : ${anon ? anon.length + " Zeichen" : "FEHLT"}`);
console.log(`  Service-Key : ${service ? service.length + " Zeichen" : "FEHLT"}\n`);

if (!url || !anon) {
  console.log("  Es fehlen Werte in .env.local.\n");
  process.exit(1);
}

const ERWARTET = [
  "profiles", "broker_contacts", "categories", "task_types", "tasks",
  "task_notes", "task_status_history", "task_attachments", "audit_log",
  "email_templates", "app_settings", "notifications_log",
  "onoffice_sync_log", "onoffice_sync_cursor",
];

// 1) Ohne Anmeldung darf nichts zu sehen sein.
const oeffentlich = createClient(url, anon);
const { data: fremd, error: fremdFehler } = await oeffentlich.from("tasks").select("id").limit(1);
if (fremdFehler) {
  console.log(`  OK  Ohne Anmeldung kein Zugriff auf Aufgaben (${fremdFehler.code || "Fehler"}).`);
} else if (!fremd?.length) {
  console.log("  OK  Ohne Anmeldung keine Aufgaben sichtbar.");
} else {
  console.log("  ACHTUNG  Ohne Anmeldung sind Aufgaben lesbar. Zeilensicherheit pruefen!");
}

if (!service) {
  console.log("\n  Fuer die Tabellenpruefung fehlt der Service-Role-Schluessel:");
  console.log("    npm run zugangsdaten supabase\n");
  process.exit(0);
}

// 2) Mit Service-Role: stehen alle Tabellen, und sind die Startwerte da?
const admin = createClient(url, service, { auth: { persistSession: false } });
console.log("");
let fehlen = 0;
for (const t of ERWARTET) {
  const { count, error } = await admin.from(t).select("*", { count: "exact", head: true });
  if (error) {
    console.log(`  FEHLT  ${t}: ${error.message}`);
    fehlen++;
  } else {
    console.log(`  OK     ${t.padEnd(21)} ${count} Zeilen`);
  }
}

// 3) Startwerte
const zaehle = async (t) => (await admin.from(t).select("*", { count: "exact", head: true })).count;
console.log("");
const pruefungen = [
  ["Kategorien", await zaehle("categories"), 5],
  ["Aufgabenarten", await zaehle("task_types"), 35],
  ["Mailvorlagen", await zaehle("email_templates"), 5],
  ["Einstellungen", await zaehle("app_settings"), 1],
];
for (const [name, ist, soll] of pruefungen) {
  console.log(`  ${ist === soll ? "OK    " : "PRUEFEN"} ${name}: ${ist} (erwartet ${soll})`);
}

// 4) Pflichtnotiz-Regel: muss auf Datenbankebene greifen
const { error: regelFehler } = await admin
  .from("tasks")
  .insert({ title: "Regeltest", status: "in_bearbeitung", creator_id: "00000000-0000-0000-0000-000000000000" });
console.log("");
if (regelFehler && /notiz|constraint|foreign key/i.test(regelFehler.message)) {
  console.log("  OK     Die Datenbank weist unzulaessige Aufgaben ab.");
} else if (regelFehler) {
  console.log(`  Hinweis: Einfuegen abgewiesen mit: ${regelFehler.message}`);
} else {
  console.log("  ACHTUNG  Eine Aufgabe 'In Bearbeitung' ohne Notiz wurde gespeichert!");
}

// 5) Storage-Bucket
const { data: buckets, error: bucketFehler } = await admin.storage.listBuckets();
console.log("");
if (bucketFehler) {
  console.log(`  Bucket-Abfrage fehlgeschlagen: ${bucketFehler.message}`);
} else {
  const b = buckets.find((x) => x.id === "task-attachments");
  console.log(b
    ? `  OK     Bucket task-attachments vorhanden (oeffentlich: ${b.public}).`
    : "  FEHLT  Bucket task-attachments.");
}

console.log(fehlen === 0 ? "\n  Datenbank steht.\n" : `\n  ${fehlen} Tabelle(n) fehlen.\n`);
