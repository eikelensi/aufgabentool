/**
 * Den Trichter einer Person ein- oder ausschalten.
 *
 * Wer verteilt, entscheidet ueber die Dosierung: Qualitaetsmanagement
 * und Geschaeftsfuehrung duerfen das, der Mitarbeiter selbst nicht -
 * sonst waere es kein Steuerungsinstrument, sondern eine Ansichtssache.
 *
 * Das Nachruecken und das Freigeben erledigt die Datenbank, sobald der
 * Schalter kippt. Hier steht nur, wer den Schalter anfassen darf.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aktuellesProfil } from "@/lib/supabase/profil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const profil = await aktuellesProfil();
  if (!profil) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  if (!["superadmin", "gf", "qm"].includes(profil.role)) {
    return NextResponse.json({ fehler: "Nicht berechtigt." }, { status: 403 });
  }

  const { userId, aktiv, grenze } = (await request.json().catch(() => ({}))) as {
    userId?: string;
    aktiv?: boolean;
    grenze?: number;
  };

  if (!userId) return NextResponse.json({ fehler: "userId fehlt." }, { status: 400 });

  const zeile: Record<string, unknown> = {};
  if (typeof aktiv === "boolean") zeile.trichter_aktiv = aktiv;
  if (typeof grenze === "number") {
    // Eine Grenze unter eins hiesse: gar keine Arbeit. Ueber fuenfzig
    // ist kein Trichter mehr.
    zeile.trichter_grenze = Math.max(1, Math.min(50, Math.round(grenze)));
  }

  if (!Object.keys(zeile).length) {
    return NextResponse.json({ ok: true, meldung: "Nichts zu ändern." });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("profiles").update(zeile).eq("id", userId);

  if (error) return NextResponse.json({ fehler: error.message }, { status: 500 });

  // Wie viele jetzt noch warten - die Zahl will der Aufrufer gleich
  // anzeigen, ohne alles neu zu laden.
  const { count } = await sb
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("assignee_id", userId)
    .eq("wartet", true)
    .neq("status", "erledigt");

  return NextResponse.json({ ok: true, wartend: count ?? 0 });
}
