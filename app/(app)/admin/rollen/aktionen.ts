"use server";

/**
 * Sichtbarkeit je Rolle und Bereich umstellen.
 *
 * Der Superadmin steht bewusst nicht in der Liste: wer alles darf, darf
 * auch alles sehen. Eine Zeile, die man versehentlich abhaken kann,
 * waere der schnellste Weg, sich selbst auszusperren.
 */

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verlangeAdmin } from "@/lib/supabase/profil";
import type { AppRole, Bereich } from "@/lib/types";

export interface Ergebnis {
  ok: boolean;
  meldung: string;
}

export async function bereichSetzen(
  rolle: AppRole,
  bereich: Bereich,
  sichtbar: boolean,
): Promise<Ergebnis> {
  const profil = await verlangeAdmin();
  if (!profil) return { ok: false, meldung: "Nicht berechtigt." };

  if (rolle === "superadmin") {
    return { ok: false, meldung: "Der Superadmin sieht immer alles – das bleibt so." };
  }

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("rollen_bereiche")
    .upsert({ role: rolle, bereich, sichtbar }, { onConflict: "role,bereich" });

  if (error) return { ok: false, meldung: error.message };

  revalidatePath("/admin/rollen");
  revalidatePath("/", "layout");

  return {
    ok: true,
    meldung: sichtbar ? "Bereich ist jetzt sichtbar." : "Bereich ist jetzt ausgeblendet.",
  };
}
