/**
 * Die Eingangstuer: wohin die Anwendung startet.
 *
 * Nicht alle fangen am selben Ort an. Wer Aufgaben abarbeitet, will
 * seinen Tag sehen; wer verteilt und beobachtet, will erst wissen, wo
 * die Arbeit gerade liegt. Deshalb schickt diese Seite ab dem
 * Qualitaetsmanagement ins Dashboard und alle anderen in "Mein Tag".
 *
 * Wichtig: das ist eine WEICHE, keine Sperre. Beide Seiten haben ihre
 * eigene Adresse und stehen im Menue - hier wird nur entschieden, was
 * ohne weitere Angabe erscheint. Wer das Dashboard nicht sehen darf,
 * landet auch nicht dort: die Seite selbst prueft das noch einmal.
 */
import { redirect } from "next/navigation";
import { aktuellesProfil } from "@/lib/supabase/profil";
import { supabaseServer } from "@/lib/supabase/server";
import { darfSehen, type AppRole, type Bereichsrechte } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Startseite() {
  const profil = await aktuellesProfil();
  if (!profil) redirect("/mein-tag");

  const sb = await supabaseServer();
  const { data } = await sb.from("rollen_bereiche").select("role, bereich, sichtbar");

  const rechte: Bereichsrechte = {};
  for (const z of data ?? []) (rechte[z.role] ??= {})[z.bereich] = z.sichtbar;

  const rolle = profil.role as AppRole;
  const insDashboard = rolle !== "user" && darfSehen(rolle, "dashboard", rechte);

  redirect(insDashboard ? "/dashboard" : "/mein-tag");
}
