/**
 * Huelle des Adminbereichs: Rechtepruefung an einer Stelle, dazu die
 * Unternavigation. Jede Unterseite prueft zusaetzlich selbst - eine
 * einzige Tuer ist mir fuer den Adminbereich zu wenig.
 */
import { aktuellesProfil, istAdmin } from "@/lib/supabase/profil";
import AdminNavigation from "./navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profil = await aktuellesProfil();

  if (!istAdmin(profil)) {
    return (
      <div className="panel p-4" style={{ maxWidth: 520 }}>
        <h1 className="mb-2 text-base font-semibold">Kein Zugriff</h1>
        <p className="muted text-xs leading-relaxed">
          Der Adminbereich ist Vorgesetzten vorbehalten. Wenn du hier etwas
          brauchst, wende dich an Eike oder Markus.
        </p>
      </div>
    );
  }

  return (
    <div>
      <AdminNavigation istSuperadmin={profil!.role === "superadmin"} />
      {children}
    </div>
  );
}
