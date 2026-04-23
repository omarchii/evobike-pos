"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface HeaderProps {
  userName: string;
  branchName: string;
  initials: string;
}

// Header sticky superior. Tap al avatar abre un bottom-sheet con la
// opción "Cerrar sesión" — no hay user-menu tradicional en el dashboard
// móvil porque solo existe un destino.
export default function Header({ userName, branchName, initials }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(() => {
      // Mismo callback que user-menu.tsx del POS — consistente con el
      // resto de la app y cae al login si el tech vuelve al mismo device.
      void signOut({ callbackUrl: "/login" });
    });
  };

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--outline-var)]/30 bg-[var(--surface)]/90 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú de usuario"
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-2 ring-[var(--surf-high)] transition-transform active:scale-95"
          style={{ background: "var(--p-container)", color: "var(--on-p-container)" }}
        >
          {initials}
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight text-[var(--on-surf)]">
            {userName}
          </h1>
          <p className="truncate text-xs text-[var(--on-surf-var)]">EvoBike {branchName}</p>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="gap-0 rounded-t-2xl border-[var(--outline-var)]/30 bg-[var(--surf-low)] text-[var(--on-surf)]"
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="text-[var(--on-surf)]">{userName}</SheetTitle>
            <p className="text-xs text-[var(--on-surf-var)]">EvoBike {branchName}</p>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4 pb-6">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isPending}
              className="flex w-full items-center gap-3 rounded-xl bg-[var(--surf-lowest)] px-4 py-3 text-sm font-medium text-[var(--on-surf)] transition-[transform,opacity] active:scale-[0.99] disabled:opacity-60"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="flex-1 text-left">Cerrar sesión</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
