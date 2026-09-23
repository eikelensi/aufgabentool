/**
 * Rollen und ihre Bereiche.
 */
import { supabaseServer } from "@/lib/supabase/server";
import RollenTabelle from "./tabelle";

export const dynamic = "force-dynamic";

export default async function RollenSeite() {
  const sb = await supabaseServer();
  const { data } = await sb.from("rollen_bereiche").select("role, bereich, sichtbar");

  const stand: Record<string, Record<string, boolean>> = {};
  for (const z of data ?? []) {
    (stand[z.role] ??= {})[z.bereich] = z.sichtbar;
  }

  return <RollenTabelle stand={stand} />;
}
