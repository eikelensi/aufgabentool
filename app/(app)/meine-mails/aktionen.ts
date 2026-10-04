"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil } from "@/lib/supabase/profil";

export interface Ergebnis {
  ok: boolean;
  meldung: string;
}

/**
 * Die eigene Abweichung speichern.
 *
 * Zwei Pruefungen, und beide gehoeren auf den Server: wer bin ich
 * (nicht, wen behauptet das Formular), und darf diese Mailart
 * ueberhaupt umgestellt werden. Ein Formularfeld laesst sich umgehen,
 * eine Serveraktion nicht - und "nutzer_darf_aendern" ist eine
 * Hausregel, keine Anzeigefrage.
 */
export async function meineMailSetzen(
  kind: string,
  werte: {
    aktiv?: boolean | null;
    tageBis?: number | null;
    wiederholenTage?: number | null;
    stunde?: number | null;
  },
): Promise<Ergebnis> {
  const profil = await aktuellesProfil();
  if (!profil) return { ok: false, meldung: "Nicht angemeldet." };

  const sb = supabaseAdmin();
  const { data: regel } = await sb
    .from("mail_regeln")
    .select("nutzer_darf_aendern, label")
    .eq("kind", kind)
    .maybeSingle();

  if (!regel) return { ok: false, meldung: "Diese Mailart gibt es nicht." };
  if (!regel.nutzer_darf_aendern) {
    return {
      ok: false,
      meldung: `„${regel.label}“ ist vom Haus festgelegt und lässt sich nicht einzeln umstellen.`,
    };
  }

  const zeile: Record<string, unknown> = {
    profile_id: profil.id,
    kind,
    updated_at: new Date().toISOString(),
  };
  if (werte.aktiv !== undefined) zeile.aktiv = werte.aktiv;
  if (werte.tageBis !== undefined) {
    zeile.tage_bis = werte.tageBis === null ? null : Math.max(0, Math.round(werte.tageBis));
  }
  if (werte.wiederholenTage !== undefined) {
    zeile.wiederholen_tage =
      werte.wiederholenTage === null ? null : Math.max(0, Math.round(werte.wiederholenTage));
  }
  if (werte.stunde !== undefined) {
    zeile.stunde = werte.stunde === null ? null : Math.min(23, Math.max(0, Math.round(werte.stunde)));
  }

  const { error } = await sb.from("mail_einstellungen").upsert(zeile, { onConflict: "profile_id,kind" });
  if (error) return { ok: false, meldung: error.message };

  revalidatePath("/meine-mails");
  return { ok: true, meldung: "Gespeichert." };
}

/** Zurueck auf die Hausregel - die eigene Zeile wird geloescht. */
export async function meineMailZuruecksetzen(kind: string): Promise<Ergebnis> {
  const profil = await aktuellesProfil();
  if (!profil) return { ok: false, meldung: "Nicht angemeldet." };

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("mail_einstellungen")
    .delete()
    .eq("profile_id", profil.id)
    .eq("kind", kind);
  if (error) return { ok: false, meldung: error.message };

  revalidatePath("/meine-mails");
  return { ok: true, meldung: "Wieder wie im Haus eingestellt." };
}
