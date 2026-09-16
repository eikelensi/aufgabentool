/**
 * Benutzerliste aus onOffice – Quelle für die Auswahl des Maklerkollegen.
 * Später schreibt dieselbe Route das Ergebnis nach broker_contacts.
 */

import { NextResponse } from "next/server";
import { fail, guard } from "@/lib/api-guard";
import { readUsers } from "@/lib/onoffice/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  try {
    const { users, resourceUsed } = await readUsers();
    return NextResponse.json({
      ok: true,
      resourceUsed,
      count: users.length,
      users: users.map((u) => ({
        onofficeUserId: u.id,
        displayName: u.displayName,
        shortCode: u.shortCode,
        email: u.email,
        isActive: u.isActive,
      })),
    });
  } catch (err) {
    return fail(err);
  }
}
