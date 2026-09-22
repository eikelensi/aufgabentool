/**
 * Prueft die Statusabbildung - die gefaehrlichste Stelle der
 * Rueckrichtung.
 *
 *   npm run status
 *
 * onOffice kennt acht Status, das Tool drei. Vier onOffice-Status landen
 * bei uns auf "offen": Nicht begonnen, Zurueckgestellt, Abgebrochen,
 * Sonstiges. Wer beim Zurueckschreiben stumpf "offen -> 1" setzt, macht
 * aus einer zurueckgestellten Aufgabe eine nicht begonnene - und niemand
 * merkt es, weil im Tool beides gleich aussieht.
 *
 * Geprueft wird deshalb nicht nur die Abbildung selbst, sondern auch die
 * Schutzregel aus app/api/onoffice/status/route.ts: geschrieben wird nur,
 * wenn sich der Status in UNSEREN Begriffen wirklich geaendert hat.
 *
 * Braucht Node 22 oder neuer (--experimental-strip-types), damit der Test
 * dieselbe Tabelle liest wie die Anwendung und keine Kopie davon. Eine
 * Kopie waere genau die Art Test, die noch gruen ist, wenn das Original
 * schon falsch ist.
 */
import { ONOFFICE_STATUS, toOnofficeStatus, toOurStatus, onofficeStatusLabel, istAbgeschlossen }
  from "../lib/onoffice/mapping.ts";
import type { TaskStatus } from "../lib/types.ts";

let fehler = 0;
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? "ok   " : "FEHLT"} ${text}`);
  if (!bedingung) fehler++;
};

console.log("\n--- Lesen: alle acht onOffice-Status ---");
for (const [zahl, { label, unser }] of Object.entries(ONOFFICE_STATUS)) {
  pruefe(toOurStatus(zahl) === unser, `Zahl ${zahl} -> ${unser}`);
  pruefe(toOurStatus(label) === unser, `"${label}" -> ${unser}`);
  pruefe(toOurStatus(label.toUpperCase()) === unser, `"${label}" gross geschrieben -> ${unser}`);
}
pruefe(toOurStatus("Zurueckgestellt") === "offen", "ohne Umlaut: Zurueckgestellt -> offen");
pruefe(toOurStatus("") === "offen", "leer -> offen");
pruefe(toOurStatus("Voellig Unbekannt") === "offen", "unbekannt -> offen");

console.log("\n--- Schreiben ---");
pruefe(toOnofficeStatus("offen") === "1", "offen -> 1 (Nicht begonnen)");
pruefe(toOnofficeStatus("in_bearbeitung") === "2", "Rueckfragen offen -> 2 (In Bearbeitung)");
pruefe(toOnofficeStatus("erledigt") === "3", "erledigt -> 3 (Erledigt)");
pruefe(onofficeStatusLabel("3") === "Erledigt", "Beschriftung zu 3");

console.log("\n--- Die Schutzregel: wird geschrieben oder nicht? ---");
// Genau die Bedingung aus app/api/onoffice/status/route.ts
const wuerdeSchreiben = (roh: string | null, unser: TaskStatus) =>
  !(roh && toOurStatus(roh) === unser);

// Das ist der Schaden, um den es geht: diese drei duerfen NICHT
// ueberschrieben werden, solange bei uns "offen" steht.
for (const roh of ["Zurückgestellt", "Sonstiges", "Nicht begonnen"]) {
  pruefe(!wuerdeSchreiben(roh, "offen"), `"${roh}" + offen -> nichts anfassen`);
}
for (const roh of ["Geprüft", "Abgebrochen"]) {
  pruefe(!wuerdeSchreiben(roh, "erledigt"), `"${roh}" + erledigt -> nichts anfassen`);
}
// Umgekehrt: wer eine abgebrochene Aufgabe im Tool wieder aufmacht,
// meint das so - das darf durchgehen.
pruefe(wuerdeSchreiben("Abgebrochen", "offen"), `"Abgebrochen" -> offen: schreiben`);
pruefe(!wuerdeSchreiben("Klärungsbedarf", "in_bearbeitung"), `"Klärungsbedarf" + Rueckfragen offen -> nichts anfassen`);

// Echte Wechsel muessen dagegen durchgehen.
pruefe(wuerdeSchreiben("Zurückgestellt", "erledigt"), `"Zurückgestellt" -> erledigt: schreiben`);
pruefe(wuerdeSchreiben("Nicht begonnen", "in_bearbeitung"), `"Nicht begonnen" -> Rueckfragen offen: schreiben`);
pruefe(wuerdeSchreiben("Erledigt", "offen"), `"Erledigt" -> offen: schreiben`);
pruefe(wuerdeSchreiben(null, "erledigt"), `ohne Rohwert: schreiben`);

console.log("\n--- Altlasten: was wird NICHT neu geholt? ---");
for (const roh of ["Erledigt", "Abgebrochen", "Geprüft", "3", "5", "7", "geprueft"]) {
  pruefe(istAbgeschlossen(roh), `"${roh}" gilt als abgeschlossen`);
}
// Zurueckgestellt ist Arbeit, die noch ansteht - die muss herein.
for (const roh of ["Nicht begonnen", "In Bearbeitung", "Zurückgestellt", "Sonstiges", "Klärungsbedarf", "", "1", "2", "4"]) {
  pruefe(!istAbgeschlossen(roh), `"${roh}" gilt NICHT als abgeschlossen`);
}

console.log(fehler ? `\n  ${fehler} Beanstandung(en).\n` : "\n  Alles in Ordnung.\n");
process.exit(fehler ? 1 : 0);