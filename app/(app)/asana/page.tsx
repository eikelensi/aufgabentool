/**
 * Der Bereich der Geschaeftsfuehrung.
 *
 * Noch leer, aber nicht verschwiegen: wer den Menuepunkt sieht, soll
 * auch lesen koennen, was hier entstehen wird und was dafuer noch
 * fehlt. Ein Punkt, der ins Nichts fuehrt, ist schlimmer als keiner.
 */
import { aktuellesProfil } from "@/lib/supabase/profil";
import { supabaseServer } from "@/lib/supabase/server";
import { darfSehen, type AppRole, type Bereichsrechte } from "@/lib/types";

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

  return (
    <div className="panel p-5" style={{ maxWidth: 680 }}>
      <h1 className="mb-2 text-base font-semibold">Asana – Buchhaltung und HR</h1>
      <p className="muted mb-4 text-xs leading-relaxed">
        Hier entsteht die Spiegelung des Asana-Projekts: Board mit seinen
        Spalten, Aufgaben mit Titel und Beschreibung, Kommentarfaden,
        Dateien – und das Pool-Board, über das eine Aufgabe in den
        Aufgabenpool des Tools wandert.
      </p>
      <ul className="muted space-y-1.5 text-xs leading-relaxed">
        <li>• Asana führt: Titel, Text, Status und Zuständigkeit kommen von dort.</li>
        <li>• Umgekehrt läuft nur der Pool-Wechsel.</li>
        <li>• Jede Aufgabe entsteht zusätzlich in onOffice, wie im Aufgabentool.</li>
      </ul>
    </div>
  );
}
