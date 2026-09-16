/**
 * Endpunkt fuer Links aus Mails: Einladung, Passwort vergessen,
 * Mailadresse bestaetigen.
 *
 * Supabase haengt token_hash und type an den Link. Hier wird der Token
 * einmalig gegen eine Sitzung getauscht; danach geht es zum Formular, wo
 * die Person ihr Passwort selbst setzt. Der Token ist danach verbraucht.
 */
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const weiter = searchParams.get("next") ?? "/passwort-setzen";

  if (!tokenHash || !type) {
    redirect("/anmelden?fehler=" + encodeURIComponent("Der Link war unvollstaendig."));
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    redirect(
      "/anmelden?fehler=" +
        encodeURIComponent(
          "Der Link ist abgelaufen oder wurde schon benutzt. Bitte neu anfordern.",
        ),
    );
  }

  redirect(weiter);
}
