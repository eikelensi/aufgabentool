/**
 * Schutz für die internen Routen.
 *
 * Solange es keinen Login gibt, verlangen die Schnittstellen- und
 * Cron-Routen ein gemeinsames Geheimnis aus INTERNAL_API_SECRET – entweder
 * als Header "x-api-secret" oder als "Authorization: Bearer …".
 * Ohne gesetztes Geheimnis antworten sie mit 503, damit nichts versehentlich
 * offen im Netz steht.
 */

import { NextResponse } from "next/server";

export function guard(request: Request): NextResponse | null {
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "INTERNAL_API_SECRET ist nicht gesetzt. Bitte eine lange Zufallszeichenkette " +
          "als Umgebungsvariable hinterlegen – sonst bleiben diese Routen gesperrt.",
      },
      { status: 503 },
    );
  }

  const header = request.headers.get("x-api-secret");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const provided = header ?? bearer ?? "";

  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: "Nicht autorisiert." }, { status: 401 });
  }

  return null;
}

export function fail(error: unknown, status = 500): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ ok: false, error: message }, { status });
}
