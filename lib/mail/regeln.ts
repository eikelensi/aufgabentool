/**
 * Wann, wie oft und ob ueberhaupt - an einer Stelle.
 *
 * Vorher stand das an drei Orten verteilt: zwei Zahlen in
 * app_settings, die Uhrzeit im Zeitplan bei Vercel, und das OB
 * nirgends - eine Mailart liess sich nur abschalten, indem man ihre
 * Vorlage deaktivierte. Das war nicht zu durchschauen.
 *
 * Jetzt: eine Hausregel je Mailart (mail_regeln) und, wo die Regel es
 * zulaesst, eine Abweichung je Person (mail_einstellungen). Die
 * Datenbank fuehrt beides in v_mail_regel_je_person zusammen, damit
 * Versand, Faelligkeitssichten und Oberflaeche dieselbe Antwort
 * bekommen.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { NotifyKind } from "@/lib/types";

export interface GeltendeRegel {
  kind: NotifyKind;
  art: "frist" | "ereignis";
  aktiv: boolean;
  tageBis: number | null;
  wiederholenTage: number;
  stunde: number;
  nutzerDarfAendern: boolean;
  weichtAb: boolean;
}

/**
 * Was gilt fuer diese Person bei dieser Mailart?
 *
 * Ohne Person (etwa die Pool-Meldung an die Hilfe - das ist eine
 * Adresse, kein Nutzer des Tools) zaehlt allein die Hausregel.
 */
export async function geltendeRegel(
  kind: NotifyKind,
  profileId?: string | null,
): Promise<GeltendeRegel | null> {
  const sb = supabaseAdmin();

  if (profileId) {
    const { data } = await sb
      .from("v_mail_regel_je_person")
      .select("kind, art, aktiv, tage_bis, wiederholen_tage, stunde, nutzer_darf_aendern, weicht_ab")
      .eq("profile_id", profileId)
      .eq("kind", kind)
      .maybeSingle();
    if (data) {
      return {
        kind: data.kind as NotifyKind,
        art: data.art === "frist" ? "frist" : "ereignis",
        aktiv: Boolean(data.aktiv),
        tageBis: data.tage_bis ?? null,
        wiederholenTage: data.wiederholen_tage ?? 0,
        stunde: data.stunde ?? 5,
        nutzerDarfAendern: Boolean(data.nutzer_darf_aendern),
        weichtAb: Boolean(data.weicht_ab),
      };
    }
    // Kein Treffer heisst: die Person ist gesperrt oder es gibt sie
    // nicht mehr. Dann faellt es auf die Hausregel zurueck, statt
    // still nichts zu schicken.
  }

  const { data: regel } = await sb
    .from("mail_regeln")
    .select("kind, art, aktiv, tage_bis, wiederholen_tage, stunde, nutzer_darf_aendern")
    .eq("kind", kind)
    .maybeSingle();

  if (!regel) return null;

  return {
    kind: regel.kind as NotifyKind,
    art: regel.art === "frist" ? "frist" : "ereignis",
    aktiv: Boolean(regel.aktiv),
    tageBis: regel.tage_bis ?? null,
    wiederholenTage: regel.wiederholen_tage ?? 0,
    stunde: regel.stunde ?? 5,
    nutzerDarfAendern: Boolean(regel.nutzer_darf_aendern),
    weichtAb: false,
  };
}

/**
 * Darf diese Mail raus?
 *
 * Gibt es zu einer Mailart gar keine Regel, wird GESENDET. Eine
 * fehlende Zeile ist ein Versehen in der Verwaltung, kein Verbot -
 * und eine Meldung, die wegen einer fehlenden Zeile ausbleibt, faellt
 * niemandem auf.
 */
export async function darfSenden(
  kind: NotifyKind,
  profileId?: string | null,
): Promise<boolean> {
  try {
    const regel = await geltendeRegel(kind, profileId);
    return regel ? regel.aktiv : true;
  } catch {
    return true;
  }
}

/**
 * Welche Stunde ist es gerade im Haus?
 *
 * Europe/Berlin, nicht UTC: "um 7" soll im Winter wie im Sommer
 * dasselbe heissen. Der Server rechnet in UTC, der Mensch nicht.
 */
export function stundeImHaus(jetzt = new Date()): number {
  const s = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    hour12: false,
  }).format(jetzt);
  return Number(s);
}
