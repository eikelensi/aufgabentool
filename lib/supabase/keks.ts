/**
 * Wie die Sitzungs-Kekse gesetzt werden - an genau einer Stelle.
 *
 * Vorgeschichte, weil sie wichtig ist: damit das Tool in onOffice als
 * Dashboard-Kachel laufen kann, hatte ich die Kekse pauschal auf
 * SameSite=none, Secure und Partitioned gestellt. Im Rahmen war das
 * richtig. Ueberall sonst war es ein Fehler.
 *
 * Der Grund: ein "Partitioned"-Keks ist fuer den Browser ein ANDERER
 * Keks als der gleichnamige ohne dieses Merkmal. Nach dem Umstellen
 * lagen beide nebeneinander, beide wurden mitgeschickt, und der
 * Server las mal den einen und mal den anderen. Ergebnis: Anmeldungen,
 * die nach kurzer Zeit wieder weg waren, und im Protokoll
 * "Invalid Refresh Token: Refresh Token Not Found".
 *
 * Deshalb jetzt danach unterschieden, OB die Seite ueberhaupt in einem
 * fremden Rahmen laeuft:
 *
 *   im eigenen Tab  - die Voreinstellung, genau wie vorher. Kein
 *                     Sonderfall, keine zweite Keksfamilie.
 *   in einem Rahmen - SameSite=none, Secure, Partitioned. Dort ist es
 *                     noetig, und dort stoert es niemanden: der Keks
 *                     gehoert zur Kombination "wir IN onOffice" und
 *                     kommt dem im eigenen Tab nicht in die Quere.
 *
 * Die Kehrseite bleibt: die Anmeldung im Rahmen ist eine andere als
 * die im eigenen Tab. Das ist der Preis, und er ist niedriger als
 * "geht nicht".
 */
import type { CookieOptions } from "@supabase/ssr";

const IM_BETRIEB = process.env.NODE_ENV === "production";

/** Die Namen, unter denen Supabase seine Sitzung ablegt. */
export function istSitzungskeks(name: string): boolean {
  return name.startsWith("sb-");
}

/**
 * Laeuft diese Anfrage in einem fremden Rahmen?
 *
 * Der Browser sagt es selbst. "sec-fetch-dest: iframe" steht an der
 * Anfrage, die den Rahmen fuellt; "sec-fetch-site: cross-site" an
 * allem, was darin danach passiert. Fehlen beide (alte Browser,
 * serverseitige Aufrufe), gilt: kein Rahmen - die vorsichtigere
 * Annahme.
 */
export function imFremdenRahmen(kopf: {
  get(name: string): string | null | undefined;
}): boolean {
  const dest = kopf.get("sec-fetch-dest") ?? "";
  const site = kopf.get("sec-fetch-site") ?? "";
  if (dest === "iframe" || dest === "frame" || dest === "embed") return true;
  return site === "cross-site" && dest !== "document";
}

export function keksOptionen(imRahmen: boolean): CookieOptions {
  if (!imRahmen || !IM_BETRIEB) return {};
  return { sameSite: "none", secure: true, partitioned: true };
}

export function mitKeksOptionen(
  options: CookieOptions | undefined,
  imRahmen: boolean,
): CookieOptions {
  return { ...options, ...keksOptionen(imRahmen) };
}
