/**
 * Huelle fuer alles hinter der Anmeldung.
 *
 * Hier wird das Profil des angemeldeten Menschen geladen und an die
 * Navigation gegeben. Die Middleware haelt Unangemeldete schon vorher ab;
 * die Pruefung hier ist die zweite Tuer - auf eine einzige Absicherung
 * sollte man sich nicht verlassen.
 */
import { redirect } from "next/navigation";
import { StoreProvider } from "@/lib/store";
import Shell from "@/components/Shell";
import { aktuellesProfil } from "@/lib/supabase/profil";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profil = await aktuellesProfil();

  if (!profil) redirect("/anmelden");

  if (!profil.isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="panel max-w-[400px] p-6">
          <h1 className="mb-2 text-base font-semibold">Zugang deaktiviert</h1>
          <p className="muted text-xs leading-relaxed">
            Dieses Konto ist abgeschaltet. Wende dich an Eike oder Markus, wenn
            das ein Versehen ist.
          </p>
          <form action="/auth/abmelden" method="post" className="mt-4">
            <button className="btn btn-ghost" type="submit">
              Abmelden
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <StoreProvider profil={profil}>
      <Shell profil={profil}>{children}</Shell>
    </StoreProvider>
  );
}
