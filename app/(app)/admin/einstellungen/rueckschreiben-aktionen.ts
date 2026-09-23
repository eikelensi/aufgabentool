"use server";

/**
 * Die Schalter fuer das Schreiben nach onOffice.
 *
 * Absichtlich eigene Aktionen und nicht Teil des allgemeinen
 * Einstellungsformulars: das hier sind die einzigen Einstellungen des
 * Tools, die fremde Daten veraendern koennen. Sie gehoeren nicht zwischen
 * Kategorienfarben und Anhangsgroessen, sondern an eine Stelle, an der
 * man merkt, was man tut - und jede Umstellung steht im Protokoll.
 */

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verlangeAdmin } from "@/lib/supabase/profil";

export interface Ergebnis {
  ok: boolean;
  meldung: string;
}

export interface Schalterstand {
  /** false = es wird geschrieben. Der Hauptschalter, invertiert benannt. */
  nurLesen: boolean;
  bearbeiter: boolean;
  status: boolean;
  inhalt: boolean;
}

const FELD = {
  nurLesen: "sync_read_only",
  bearbeiter: "sync_push_assignee",
  status: "sync_push_status",
  inhalt: "sync_push_inhalt",
} as const;

const KLARTEXT: Record<keyof typeof FELD, string> = {
  nurLesen: "Hauptschalter „nur lesen“",
  bearbeiter: "Bearbeiter zurückschreiben",
  status: "Status zurückschreiben",
  inhalt: "Betreff, Text, Frist und Priorität zurückschreiben",
};

export async function schalterSetzen(
  welcher: keyof typeof FELD,
  an: boolean,
): Promise<Ergebnis> {
  let wer = "";
  try {
    const profil = await verlangeAdmin();
    wer = profil?.email ?? "";
  } catch (err) {
    return { ok: false, meldung: (err as Error).message };
  }

  if (!(welcher in FELD)) return { ok: false, meldung: "Unbekannter Schalter." };

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("app_settings")
    .update({ [FELD[welcher]]: an, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) return { ok: false, meldung: error.message };

  // Ins Protokoll, nicht nur in die Tabelle. Wer wann das Schreiben in
  // ein fremdes System freigegeben hat, will man spaeter nachlesen
  // koennen - und der Trigger auf app_settings haelt die Zeile ohnehin
  // fest, aber nicht in lesbaren Worten.
  await sb.from("onoffice_sync_log").insert({
    direction: "push",
    resource: "einstellung",
    reference: FELD[welcher],
    ok: true,
    message: `${KLARTEXT[welcher]} ${an ? "eingeschaltet" : "ausgeschaltet"}`,
    payload: { durch: wer },
  });

  revalidatePath("/admin/einstellungen");
  revalidatePath("/admin/protokoll");

  return {
    ok: true,
    meldung:
      welcher === "nurLesen"
        ? an
          ? "Nur lesen. Nach onOffice wird ab jetzt nichts geschrieben."
          : "Schreiben freigegeben. Was tatsächlich geschrieben wird, sagen die beiden Schalter darunter."
        : `${KLARTEXT[welcher]}: ${an ? "eingeschaltet" : "ausgeschaltet"}.`,
  };
}
