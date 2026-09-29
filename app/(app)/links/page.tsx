/**
 * Verlinkungen - die uebrigen Anwendungen des Hauses.
 *
 * Lager, Akademie, Formularwesen liegen auf eigenen Adressen. Wer sie
 * suchte, hatte ein Lesezeichen oder fragte jemanden. Hier stehen sie
 * an einer Stelle, gepflegt in der Verwaltung.
 *
 * Bewusst nur eine Liste von Adressen: das Tool ruft diese Seiten nie
 * selbst auf. Alles andere waere eine Anbindung, und die will gepflegt
 * werden - drei Kacheln nicht.
 *
 * Optional heisst: der Bereich laesst sich je Rolle abschalten, wie
 * jeder andere. Die Tuer steht deshalb auch hier und nicht nur im
 * Menue - ein ausgeblendeter Menuepunkt ist keine Sperre.
 */
import { aktuellesProfil } from "@/lib/supabase/profil";
import { supabaseServer } from "@/lib/supabase/server";
import { darfSehen, type AppRole, type Bereichsrechte } from "@/lib/types";
import Liste from "./liste";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verlinkungen – Aufgabentool" };

export default async function LinkSeite() {
  const profil = await aktuellesProfil();
  const sb = await supabaseServer();
  const { data } = await sb.from("rollen_bereiche").select("role, bereich, sichtbar");

  const rechte: Bereichsrechte = {};
  for (const z of data ?? []) (rechte[z.role] ??= {})[z.bereich] = z.sichtbar;

  if (!profil || !darfSehen(profil.role as AppRole, "links", rechte)) {
    return (
      <div className="panel p-4" style={{ maxWidth: 520 }}>
        <h1 className="mb-2 text-base font-semibold">Kein Zugriff</h1>
        <p className="muted text-xs leading-relaxed">
          Dieser Bereich ist für deine Rolle nicht freigegeben.
        </p>
      </div>
    );
  }

  return <Liste />;
}
