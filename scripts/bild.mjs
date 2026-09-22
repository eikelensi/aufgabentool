/**
 * Macht ein Bild der Musterseite in beiden Modi.
 *
 *   npm run build && npm run bild
 *
 * Nimmt das fertig uebersetzte Stylesheet aus .next/static/css und
 * setzt scripts/muster.html davor. Geschrieben wird
 * scripts/muster-hell.png und scripts/muster-dunkel.png.
 *
 * Damit sieht man einen Farbentwurf, bevor er jemandem auf den
 * Bildschirm faellt - ohne Datenbank, ohne Anmeldung, ohne Deployment.
 * Braucht Playwright; ist es nicht da, sagt das Skript das und hoert
 * auf, statt mit einem Stapel zu enden.
 */
import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..");
const cssOrdner = join(wurzel, ".next/static/css");

let dateien = [];
try {
  dateien = readdirSync(cssOrdner).filter((d) => d.endsWith(".css"));
} catch {
  /* faellt unten auf die gleiche Meldung */
}
if (!dateien.length) {
  console.log("\n  Kein uebersetztes Stylesheet gefunden. Erst:  npm run build\n");
  process.exit(1);
}

// createRequire statt import: Playwright liegt haeufig global und nicht
// im Projekt, und require findet es dort noch, wo import aufgibt.
const hole = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = hole("playwright"));
} catch {
  console.log("\n  Playwright fehlt.  npm i -D playwright  und dann erneut.\n");
  process.exit(1);
}

const vorlage = readFileSync(join(wurzel, "scripts/muster.html"), "utf8");
const seite = join(wurzel, "scripts/.muster-fertig.html");
writeFileSync(seite, vorlage.replace("STYLESHEET", join(cssOrdner, dateien[0])));

const browser = await chromium.launch();
try {
  for (const [modus, merkmal] of [["hell", "light"], ["dunkel", "dark"]]) {
    const tab = await browser.newPage({ viewport: { width: 820, height: 620 } });
    await tab.goto(pathToFileURL(seite).href);
    await tab.evaluate((m) => {
      document.documentElement.dataset.theme = m;
    }, merkmal);
    const ziel = join(wurzel, `scripts/muster-${modus}.png`);
    await tab.screenshot({ path: ziel, fullPage: true });
    await tab.close();
    console.log(`  geschrieben: scripts/muster-${modus}.png`);
  }
} finally {
  await browser.close();
  rmSync(seite, { force: true });
}
