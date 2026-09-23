/**
 * Der Bereich der Geschaeftsfuehrung.
 *
 * Die Tuer: hier wird nur geprueft, wer hereindarf. Das Board selbst
 * ist eine Clientkomponente, weil es zieht und schiebt.
 */
import { aktuellesProfil } from "@/lib/supabase/profil";
import { supabaseServer } from "@/lib/supabase/server";
import { darfSehen, type AppRole, type Bereichsrechte } from "@/lib/types";
import AsanaBoard from "./board";

export const dynamic = "force-dynamic";

export default async function AsanaSeite() {
  const profil = await aktuellesProfil();
  const sb = await supabaseServer();
  const { data } = await sb.from("rollen_bereiche").select("role, bereich, sichtbar");

  const rechte: Bereichsrechte = {};
  for (const z of data ?? []) (rechte[z.role] ??= {})[z.bereich] = z.sichtbar;

  if (!profil || !darfSehen(profil.role as AppRole, "asana", rechte)) {
    return (
      <div className="panel p-4" style={{ maxWidth: 520 }}>
        <h1 className="mb-2 text-base font-semibold">Kein Zugriff</h1>
        <p className="muted text-xs leading-relaxed">
          Dieser Bereich ist der Geschäftsführung vorbehalten.
        </p>
      </div>
    );
  }

  return <AsanaBoard />;
}
