"use server";

/**
 * Farben eines Modus speichern oder zuruecksetzen.
 *
 * Geprueft wird zweimal: hier im Code und noch einmal von der Datenbank
 * (Regeln app_settings_theme_light_nur_hexfarben und
 * ..._theme_dark_nur_hexfarben). Die Werte landen spaeter in einem
 * style-Block, und ein einzelnes Schloss an so einer Tuer ist mir zu
 * wenig.
 *
 * Der Modus kommt aus dem Formular und wird deshalb selbst geprueft -
 * er bestimmt, in welche Spalte geschrieben wird.
 */

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verlangeAdmin } from "@/lib/supabase/profil";
import {
  FARB_FELDER,
  MODUS_LABEL,
  SPALTE,
  VOREINSTELLUNG,
  istHexfarbe,
  type Modus,
  type Palette,
} from "@/lib/design/farben";

export interface Ergebnis {
  ok: boolean;
  meldung: string;
}

function leseModus(roh: unknown): Modus | null {
  return roh === "hell" || roh === "dunkel" ? roh : null;
}

export async function farbenSpeichern(formData: FormData): Promise<Ergebnis> {
  try {
    await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  const modus = leseModus(formData.get("modus"));
  if (!modus) return { ok: false, meldung: "Unbekannter Modus." };

  const palette = {} as Palette;

  for (const { schluessel, label } of FARB_FELDER) {
    const wert = String(formData.get(schluessel) ?? "").trim().toLowerCase();
    if (!istHexfarbe(wert)) {
      return { ok: false, meldung: `„${label}“ ist keine gültige Farbe (erwartet wird #rrggbb).` };
    }
    palette[schluessel] = wert;
  }

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("app_settings")
    .update({ [SPALTE[modus]]: palette, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) {
    if (/nur_hexfarben/.test(error.message)) {
      return { ok: false, meldung: "Die Datenbank hat einen der Werte abgelehnt." };
    }
    return { ok: false, meldung: error.message };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    meldung: `Gespeichert. Der ${MODUS_LABEL[modus].toLowerCase()} sieht jetzt überall so aus.`,
  };
}

export async function farbenZuruecksetzen(modusRoh: string): Promise<Ergebnis> {
  try {
    await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  const modus = leseModus(modusRoh);
  if (!modus) return { ok: false, meldung: "Unbekannter Modus." };

  const sb = supabaseAdmin();
  // NULL statt der Voreinstellung: so gilt wieder, was im Code steht,
  // und eine spaetere Verbesserung kommt automatisch an.
  const { error } = await sb
    .from("app_settings")
    .update({ [SPALTE[modus]]: null, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) return { ok: false, meldung: error.message };

  revalidatePath("/", "layout");
  return {
    ok: true,
    meldung:
      `Zurückgesetzt auf die ausgelieferten Farben ` +
      `(Hintergrund ${VOREINSTELLUNG[modus].bg}).`,
  };
}
