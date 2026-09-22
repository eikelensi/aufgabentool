"use server";

/**
 * Farben des dunklen Modus speichern.
 *
 * Geprueft wird zweimal: hier im Code und noch einmal von der Datenbank
 * (Regel app_settings_theme_dark_nur_hexfarben). Die Werte landen spaeter
 * in einem style-Block, und ein einzelnes Schloss an so einer Tuer ist
 * mir zu wenig.
 */

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verlangeAdmin } from "@/lib/supabase/profil";
import {
  DUNKEL_VOREINSTELLUNG,
  FARB_FELDER,
  istHexfarbe,
  type Dunkelfarben,
} from "@/lib/design/farben";

export interface Ergebnis {
  ok: boolean;
  meldung: string;
}

export async function farbenSpeichern(formData: FormData): Promise<Ergebnis> {
  try {
    await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  const farben = {} as Dunkelfarben;

  for (const { schluessel, label } of FARB_FELDER) {
    const wert = String(formData.get(schluessel) ?? "").trim().toLowerCase();
    if (!istHexfarbe(wert)) {
      return { ok: false, meldung: `„${label}“ ist keine gültige Farbe (erwartet wird #rrggbb).` };
    }
    farben[schluessel] = wert;
  }

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("app_settings")
    .update({ theme_dark: farben, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) {
    if (/nur_hexfarben/.test(error.message)) {
      return { ok: false, meldung: "Die Datenbank hat einen der Werte abgelehnt." };
    }
    return { ok: false, meldung: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true, meldung: "Gespeichert. Der dunkle Modus sieht jetzt überall so aus." };
}

export async function farbenZuruecksetzen(): Promise<Ergebnis> {
  try {
    await verlangeAdmin();
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  const sb = supabaseAdmin();
  // NULL statt der Voreinstellung: so gilt wieder, was im Code steht,
  // und eine spaetere Verbesserung kommt automatisch an.
  const { error } = await sb
    .from("app_settings")
    .update({ theme_dark: null, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) return { ok: false, meldung: error.message };

  revalidatePath("/", "layout");
  return {
    ok: true,
    meldung: `Zurückgesetzt auf die ausgelieferten Farben (Hintergrund ${DUNKEL_VOREINSTELLUNG.bg}).`,
  };
}
