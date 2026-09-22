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
import { supabaseServer } from "@/lib/supabase/server";
import { istVoreinstellung, sicherePalette, themaCss } from "@/lib/design/farben";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profil = await aktuellesProfil();

  if (!profil) redirect("/anmelden");

  // Eigene Farben, falls eingestellt - je Modus getrennt. sicherePalette
  // laesst nur Hexwerte durch; der Text landet in einem style-Block.
  //
  // Ausgeliefert wird nichts: steht ein Modus auf der Voreinstellung,
  // gilt schlicht, was in globals.css steht. So faellt eine spaetere
  // Verbesserung der Voreinstellung auch bei allen an, die nie etwas
  // eingestellt haben.
  const supabase = await supabaseServer();
  const { data: einst } = await supabase
    .from("app_settings")
    .select("theme_light, theme_dark")
    .maybeSingle();
  const hell = sicherePalette("hell", einst?.theme_light);
  const dunkel = sicherePalette("dunkel", einst?.theme_dark);

  const eigeneFarben = [
    istVoreinstellung("hell", hell) ? "" : themaCss("hell", hell),
    istVoreinstellung("dunkel", dunkel) ? "" : themaCss("dunkel", dunkel),
  ]
    .filter(Boolean)
    .join("");

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
      {eigeneFarben ? <style dangerouslySetInnerHTML={{ __html: eigeneFarben }} /> : null}
      <Shell profil={profil}>{children}</Shell>
    </StoreProvider>
  );
}
