"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";

export interface Ergebnis {
  ok: boolean;
  meldung: string;
}

/**
 * Eine Regel aendern.
 *
 * Die Grenzen stehen hier und nicht nur im Formular: ein Feld laesst
 * sich umgehen, eine Serveraktion nicht. Null Tage hiesse "sofort nach
 * dem Anlegen", null Stunde ist Mitternacht - beides erlaubt, aber
 * negative Werte und Stunden ueber 23 nicht.
 */
export async function regelSetzen(
  kind: string,
  werte: {
    aktiv?: boolean;
    tageBis?: number | null;
    wiederholenTage?: number;
    stunde?: number;
    nutzerDarfAendern?: boolean;
  },
): Promise<Ergebnis> {
  if (!istAdmin(await aktuellesProfil())) {
    return { ok: false, meldung: "Nicht berechtigt." };
  }

  const zeile: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (werte.aktiv !== undefined) zeile.aktiv = werte.aktiv;
  if (werte.nutzerDarfAendern !== undefined) zeile.nutzer_darf_aendern = werte.nutzerDarfAendern;
  if (werte.tageBis !== undefined) {
    zeile.tage_bis = werte.tageBis === null ? null : Math.max(0, Math.round(werte.tageBis));
  }
  if (werte.wiederholenTage !== undefined) {
    zeile.wiederholen_tage = Math.max(0, Math.round(werte.wiederholenTage));
  }
  if (werte.stunde !== undefined) {
    zeile.stunde = Math.min(23, Math.max(0, Math.round(werte.stunde)));
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("mail_regeln").update(zeile).eq("kind", kind);
  if (error) return { ok: false, meldung: error.message };

  revalidatePath("/admin/mail/regeln");
  return { ok: true, meldung: "Gespeichert." };
}

/**
 * Eine Mailart fuer eine einzelne Person ab- oder wieder einschalten.
 *
 * Das darf nur der Admin - die Mitarbeiter stellen das nicht mehr
 * selbst um. Abschalten legt eine Zeile mit aktiv = false an.
 * Einschalten nimmt die Abweichung wieder heraus, statt "aktiv = true"
 * zu speichern: dann gilt wieder die Hausregel, und schaltet das Haus
 * die Mailart spaeter ab, ist sie auch fuer diese Person aus.
 */
export async function personMailSetzen(
  profileId: string,
  kind: string,
  aktiv: boolean,
): Promise<Ergebnis> {
  if (!istAdmin(await aktuellesProfil())) {
    return { ok: false, meldung: "Nicht berechtigt." };
  }

  const sb = supabaseAdmin();
  const { data: regel } = await sb.from("mail_regeln").select("kind").eq("kind", kind).maybeSingle();
  if (!regel) return { ok: false, meldung: "Diese Mailart gibt es nicht." };

  if (!aktiv) {
    const { error } = await sb.from("mail_einstellungen").upsert(
      { profile_id: profileId, kind, aktiv: false, updated_at: new Date().toISOString() },
      { onConflict: "profile_id,kind" },
    );
    if (error) return { ok: false, meldung: error.message };
  } else {
    // Alte Zeilen koennen noch eigene Zeiten tragen (aus der Zeit, als
    // jeder selbst umstellen durfte). Die bleiben stehen, nur das
    // Abschalten faellt weg; eine leere Zeile wird ganz entfernt.
    const { error } = await sb
      .from("mail_einstellungen")
      .update({ aktiv: null, updated_at: new Date().toISOString() })
      .eq("profile_id", profileId)
      .eq("kind", kind);
    if (error) return { ok: false, meldung: error.message };
    await sb
      .from("mail_einstellungen")
      .delete()
      .eq("profile_id", profileId)
      .eq("kind", kind)
      .is("aktiv", null)
      .is("tage_bis", null)
      .is("wiederholen_tage", null)
      .is("stunde", null);
  }

  revalidatePath("/admin/mail/regeln");
  revalidatePath("/meine-mails");
  return { ok: true, meldung: aktiv ? "Wieder eingeschaltet." : "Für diese Person abgeschaltet." };
}
