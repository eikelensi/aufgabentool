/** Abmelden. Bewusst nur per POST, damit kein Link und kein Vorlader
 *  jemanden versehentlich abmeldet. */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/anmelden", request.url), { status: 303 });
}
