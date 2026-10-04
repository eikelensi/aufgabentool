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
