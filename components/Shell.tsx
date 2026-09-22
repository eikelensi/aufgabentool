"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { NewTaskDialog } from "./dialogs";
import type { AppRole } from "@/lib/types";

export interface ShellProfil {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
}

const NAV = [
  { href: "/", label: "Mein Tag" },
  { href: "/pool", label: "Aufgabenpool" },
  { href: "/onoffice", label: "onOffice-Eingang" },
  { href: "/uebersicht", label: "Übersicht", adminOnly: true },
  { href: "/admin", label: "Verwaltung", adminOnly: true },
];

const ROLLE_LABEL: Record<AppRole, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  mitarbeiter: "Mitarbeiter",
};

function initialen(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return "?";
  if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase();
  return (teile[0][0] + teile[teile.length - 1][0]).toUpperCase();
}

export default function Shell({
  children,
  profil,
}: {
  children: React.ReactNode;
  profil: ShellProfil;
}) {
  const { neuLaden, bereit } = useStore();
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [menuOffen, setMenuOffen] = useState(false);

  const isAdmin = profil.role === "admin" || profil.role === "superadmin";

  useEffect(() => {
    let gespeichert: string | null = null;
    try {
      gespeichert = window.localStorage.getItem("aufgabentool-theme");
    } catch {
      /* Privatmodus oder gesperrte Speicherung - dann eben die Systemwahl */
    }
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = gespeichert ? gespeichert === "dark" : prefers;
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      window.localStorage.setItem("aufgabentool-theme", next ? "dark" : "light");
    } catch {
      /* nicht wichtig genug, um darueber zu stolpern */
    }
  };

  const nav = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-screen">
      <header
        className="line sticky top-0 z-40 border-b"
        style={{ background: "var(--panel)" }}
      >
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5" title="Aufgabentool">
            <Image
              src="/logo.png"
              alt="4wändekanzlei"
              width={736}
              height={120}
              priority
              className="h-6 w-auto"
            />
            <span className="line muted border-l pl-2.5 text-[13px] font-medium">
              Aufgabentool
            </span>
          </Link>

          <nav className="scroll-x flex items-center gap-0.5">
            {nav.map((n) => {
              const active =
                n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-md px-2.5 py-1.5 text-[13px] font-medium transition"
                  style={
                    active
                      ? { background: "var(--color-ci-400)", color: "var(--auf-akzent)" }
                      : { color: "var(--muted)" }
                  }
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button className="btn btn-primary" onClick={() => setNewTask(true)}>
              + Aufgabe
            </button>
            <button className="btn btn-ghost" onClick={toggleTheme} title="Design umschalten">
              {dark ? "☀️" : "🌙"}
            </button>

            <div className="relative">
              <button
                className="flex items-center gap-1.5 rounded-md px-1 py-0.5"
                onClick={() => setMenuOffen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOffen}
                title={profil.email}
              >
                <span
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: "var(--color-ci-400)", color: "var(--auf-akzent)" }}
                >
                  {initialen(profil.fullName)}
                </span>
                <span className="muted hidden text-[12px] sm:inline">
                  {profil.fullName}
                </span>
              </button>

              {menuOffen ? (
                <div
                  className="panel absolute right-0 z-50 mt-1 w-[230px] p-2 text-[12px]"
                  role="menu"
                >
                  <div className="line mb-2 border-b pb-2">
                    <div className="font-medium">{profil.fullName}</div>
                    <div className="muted text-[11px]">{profil.email}</div>
                    <div className="muted text-[11px]">{ROLLE_LABEL[profil.role]}</div>
                  </div>
                  <Link
                    href="/passwort-setzen"
                    className="block rounded px-1.5 py-1 hover:underline"
                    onClick={() => setMenuOffen(false)}
                  >
                    Passwort ändern
                  </Link>
                  <form action="/auth/abmelden" method="post">
                    <button
                      className="mt-0.5 w-full rounded px-1.5 py-1 text-left hover:underline"
                      type="submit"
                    >
                      Abmelden
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="line border-t px-4 py-1 text-[11px]"
          style={{ background: "var(--panel-2)", color: "var(--muted)" }}
        >
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2">
            <strong style={{ color: "var(--color-ci-500)" }}>Live</strong>
            <span>
              {bereit
                ? "Echte Daten. Aufgaben kommen aus onOffice, sobald Bearbeiter oder Verantwortung ein Nutzer ist."
                : "Lade Daten…"}
            </span>
            <button
              className="btn btn-ghost ml-auto"
              style={{ fontSize: 11 }}
              onClick={() => void neuLaden()}
            >
              Neu laden
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5">{children}</main>

      {newTask ? <NewTaskDialog onClose={() => setNewTask(false)} /> : null}
    </div>
  );
}
