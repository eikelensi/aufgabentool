"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { NewTaskDialog } from "./dialogs";
import { Avatar } from "./ui";

const NAV = [
  { href: "/", label: "Mein Tag" },
  { href: "/pool", label: "Aufgabenpool" },
  { href: "/onoffice", label: "onOffice-Eingang" },
  { href: "/uebersicht", label: "Übersicht", adminOnly: true },
  { href: "/admin", label: "Adminbereich", adminOnly: true },
  { href: "/protokoll", label: "Mail-Protokoll", adminOnly: true },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { me, profiles, setCurrentUser, isAdmin, resetDemo } = useStore();
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const [newTask, setNewTask] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("aufgabentool-theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefers;
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("aufgabentool-theme", next ? "dark" : "light");
  };

  const nav = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-screen">
      <header
        className="line sticky top-0 z-40 border-b"
        style={{ background: "var(--panel)" }}
      >
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-black"
              style={{ background: "var(--color-ci-400)", color: "#10200a" }}
            >
              4
            </span>
            <span className="text-sm font-semibold leading-tight">
              Aufgabentool
              <span className="muted ml-1.5 font-normal">4wändekanzlei</span>
            </span>
          </Link>

          <nav className="scroll-x flex items-center gap-0.5">
            {nav.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-md px-2.5 py-1.5 text-[13px] font-medium transition"
                  style={
                    active
                      ? { background: "var(--color-ci-400)", color: "#10200a" }
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
            <div className="flex items-center gap-1.5">
              <Avatar profile={me} size={26} />
              <select
                className="field"
                style={{ width: "auto", padding: "0.3rem 0.5rem", fontSize: "0.75rem" }}
                value={me.id}
                onChange={(e) => setCurrentUser(e.target.value)}
                title="Demo: Benutzer wechseln"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.role === "mitarbeiter" ? "Mitarbeiter" : "Admin"})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div
          className="line border-t px-4 py-1 text-[11px]"
          style={{ background: "var(--panel-2)", color: "var(--muted)" }}
        >
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2">
            <strong style={{ color: "var(--color-ci-500)" }}>Prototyp</strong>
            <span>
              Demo-Daten im Browser, keine Datenbank, keine echten E-Mails. Benutzer oben rechts
              umschalten, um Rollen zu testen.
            </span>
            <button className="btn btn-ghost ml-auto" style={{ fontSize: 11 }} onClick={resetDemo}>
              Demo zurücksetzen
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5">{children}</main>

      {newTask ? <NewTaskDialog onClose={() => setNewTask(false)} /> : null}
    </div>
  );
}
