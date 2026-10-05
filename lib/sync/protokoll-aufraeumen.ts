/**
 * Alte Protokollzeilen wegraeumen - getrennt nach Zweck.
 *
 * Laeuft im stuendlichen Mail-Zeitplan mit, einmal am Tag. Ein
 * eigener Zeitplan waere ein weiterer Ort, an dem etwas stillschweigend
 * aufhoeren kann; angehaengt an einen Lauf, den es ohnehin gibt, faellt
 * sein Ausbleiben zusammen mit dem auf.
 *
 * Geloescht wird in Haeppchen. Ein DELETE ueber 100.000 Zeilen sperrt
 * die Tabelle laenger, als eine Serverless-Funktion lebt - und bricht
 * dann mitten im Vorgang ab, ohne dass etwas weg waere.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";

const HAEPPCHEN = 2000;

interface Aufraeumziel {
  tabelle: string;
  tage: number;
}

export async function raeumeProtokolleAuf(): Promise<{
  geloescht: Record<string, number>;
  hinweise: string[];
}> {
  const sb = supabaseAdmin();
  const geloescht: Record<string, number> = {};
  const hinweise: string[] = [];

  const { data: einst } = await sb
    .from("app_settings")
    .select("protokoll_tage_technik, protokoll_tage_verlauf")
    .maybeSingle();

  const technik = einst?.protokoll_tage_technik ?? 30;
  const verlauf = einst?.protokoll_tage_verlauf ?? 730;

  const ziele: Aufraeumziel[] = [
    { tabelle: "onoffice_sync_log", tage: technik },
    { tabelle: "notifications_log", tage: technik },
    { tabelle: "audit_log", tage: verlauf },
    { tabelle: "task_events", tage: verlauf },
    { tabelle: "task_status_history", tage: verlauf },
  ];

  for (const ziel of ziele) {
    // 0 heisst ausdruecklich: nie loeschen. Nicht "sofort loeschen" -
    // das waere die teuerste Fehlbedienung, die dieses Feld zulaesst.
    if (!ziel.tage || ziel.tage <= 0) continue;

    const grenze = new Date(Date.now() - ziel.tage * 864e5).toISOString();

    try {
      const { data: alt } = await sb
        .from(ziel.tabelle)
        .select("id")
        .lt("created_at", grenze)
        .limit(HAEPPCHEN);

      const ids = (alt ?? []).map((z) => (z as { id: string | number }).id);
      if (!ids.length) continue;

      const { error } = await sb.from(ziel.tabelle).delete().in("id", ids);
      if (error) {
        hinweise.push(`${ziel.tabelle}: ${error.message}`);
        continue;
      }
      geloescht[ziel.tabelle] = ids.length;
    } catch (err) {
      hinweise.push(`${ziel.tabelle}: ${(err as Error).message}`);
    }
  }

  return { geloescht, hinweise };
}
