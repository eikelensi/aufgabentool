/**
 * Farben des dunklen Modus einstellen.
 */
import { supabaseAdmin, serviceRoleVorhanden } from "@/lib/supabase/admin";
import { sichereFarben } from "@/lib/design/farben";
import FarbFormular from "./formular";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Darstellung – Aufgabentool" };

export default async function DarstellungSeite() {
  if (!serviceRoleVorhanden()) {
    return (
      <div className="panel p-4" style={{ maxWidth: 560 }}>
        <p className="muted text-xs">Es fehlt der Service-Role-Schlüssel.</p>
      </div>
    );
  }

  const sb = supabaseAdmin();
  const { data } = await sb.from("app_settings").select("theme_dark").maybeSingle();

  return (
    <div>
      <p className="muted mb-4 max-w-[70ch] text-xs leading-relaxed">
        Diese Farben gelten für den dunklen Modus – für alle, nicht nur für dich.
        Der helle Modus bleibt unverändert. Während du einstellst, ändert sich die
        Seite unter dir mit; gespeichert wird erst auf Knopfdruck.
      </p>

      <FarbFormular gespeichert={sichereFarben(data?.theme_dark)} />
    </div>
  );
}
