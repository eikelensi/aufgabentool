/**
 * Supabase auf dem Server - liest die Sitzung aus den Cookies.
 *
 * Auch hier gilt die Zeilensicherheit: dieser Client handelt im Namen des
 * angemeldeten Menschen, nicht als Administrator.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { mitKeksOptionen } from "./keks";

export async function supabaseServer() {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(liste) {
          // In Server-Komponenten ist Schreiben nicht erlaubt; dort erneuert
          // die Middleware die Sitzung. Deshalb bewusst stillschweigend.
          try {
            for (const { name, value, options } of liste)
              store.set(name, value, mitKeksOptionen(options));
          } catch {
            /* absichtlich leer */
          }
        },
      },
    },
  );
}
