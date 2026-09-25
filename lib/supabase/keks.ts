/**
 * Wie die Sitzungs-Kekse gesetzt werden - an genau einer Stelle.
 *
 * Der Anlass: das Tool soll sich in onOffice als Dashboard-Kachel
 * einhaengen lassen. Darin laeuft es in einem Rahmen auf einer FREMDEN
 * Seite, und fuer den Browser ist unser Keks dann ein Keks von
 * Dritten. Mit der Voreinstellung (SameSite=Lax) schickt er ihn dort
 * nicht mit - die Anmeldung scheiterte, ohne dass irgendetwas kaputt
 * war.
 *
 * Drei Angaben loesen das:
 *
 *   sameSite: "none"  - darf auch in fremdem Rahmen mit.
 *   secure: true      - dafuer zwingend, sonst nimmt ihn kein Browser.
 *   partitioned: true - der Keks gehoert zur Kombination "unsere
 *                       Seite IN onOffice" und nicht allgemein zu uns.
 *                       Das ist es, was ihn an Chromes Sperre fuer
 *                       Drittanbieter-Kekse vorbeibringt.
 *
 * Die Kehrseite von "partitioned": die Anmeldung im Rahmen ist eine
 * ANDERE als die im eigenen Tab. Wer beides nutzt, meldet sich zweimal
 * an. Das ist der Preis, und er ist niedriger als "geht nicht".
 *
 * Nur ueber HTTPS. In der oertlichen Entwicklung (http://localhost)
 * wuerde "secure" den Keks verwerfen und die Anmeldung unmoeglich
 * machen - dort bleibt alles wie bisher.
 */
import type { CookieOptions } from "@supabase/ssr";

const IM_BETRIEB = process.env.NODE_ENV === "production";

export const KEKS_OPTIONEN: CookieOptions = IM_BETRIEB
  ? { sameSite: "none", secure: true, partitioned: true }
  : {};

/** Vorgaben unter die von Supabase gelegt - Name und Pfad bleiben deren Sache. */
export function mitKeksOptionen(options: CookieOptions | undefined): CookieOptions {
  return { ...options, ...KEKS_OPTIONEN };
}
