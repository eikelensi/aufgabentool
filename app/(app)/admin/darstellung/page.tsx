/**
 * Farben beider Modi einstellen.
 */
import { supabaseAdmin, serviceRoleVorhanden } from "@/lib/supabase/admin";
import { sicherePalette } from "@/lib/design/farben";
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
  const { data } = await sb
    .from("app_settings")
    .select("theme_light, theme_dark")
    .maybeSingle();

  return (
    <div>
      <p className="muted mb-4 max-w-[70ch] text-xs leading-relaxed">
        Diese Farben gelten für alle, nicht nur für dich. Heller und dunkler
        Modus werden getrennt gepflegt – oben wählst du, welchen du gerade
        bearbeitest. Während du einstellst, ändert sich die Seite unter dir
        mit; gespeichert wird erst auf Knopfdruck.
      </p>

      <FarbFormular
        gespeichert={{
          hell: sicherePalette("hell", data?.theme_light),
          dunkel: sicherePalette("dunkel", data?.theme_dark),
        }}
      />
    </div>
  );
}
