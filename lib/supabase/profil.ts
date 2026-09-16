/**
 * Wer ist angemeldet, und was darf die Person?
 *
 * Diese Helfer sind fuer Server-Komponenten und Serveraktionen. Sie sind
 * die einzige Stelle, an der die Rolle bestimmt wird - nirgends sonst im
 * Code wird geraten, ob jemand Admin ist.
 */
import { supabaseServer } from "./server";
import type { AppRole } from "@/lib/types";

export interface AngemeldetesProfil {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
  onofficeUsername: string | null;
}

/** Null, wenn niemand angemeldet ist oder das Profil fehlt. */
export async function aktuellesProfil(): Promise<AngemeldetesProfil | null> {
  const supabase = await supabaseServer();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active, onoffice_username")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role as AppRole,
    isActive: data.is_active,
    onofficeUsername: data.onoffice_username,
  };
}

export function istAdmin(profil: AngemeldetesProfil | null): boolean {
  return profil?.role === "admin" || profil?.role === "superadmin";
}

/**
 * Fuer Serveraktionen: wirft, wenn die Person kein Admin ist. Bewusst eine
 * Ausnahme und kein stilles false - eine Aktion, die Rechte braucht, soll
 * nicht versehentlich halb durchlaufen.
 */
export async function verlangeAdmin(): Promise<AngemeldetesProfil> {
  const profil = await aktuellesProfil();
  if (!profil) throw new Error("Nicht angemeldet.");
  if (!profil.isActive) throw new Error("Dieses Konto ist deaktiviert.");
  if (!istAdmin(profil)) throw new Error("Diese Aktion ist dem Adminbereich vorbehalten.");
  return profil;
}
