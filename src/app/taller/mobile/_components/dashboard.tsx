"use client";

import type { SerializedMobileOrder } from "@/lib/workshop-mobile";

interface DashboardProps {
  userName: string;
  branchName: string;
  orders: SerializedMobileOrder[];
}

// G.1 — scaffolding mínimo (solo renderiza lo suficiente para validar
// auth + query). La UI completa (tabs, KPI, cards, FAB) aterriza en G.2.
export default function Dashboard({ userName, branchName, orders }: DashboardProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-8 pt-6">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-[var(--on-surf-var)]">
          {branchName}
        </p>
        <h1 className="mt-1 font-[var(--font-display)] text-2xl font-bold text-[var(--p)]">
          {userName}
        </h1>
      </header>
      <section className="rounded-2xl bg-[var(--surf-low)] p-5">
        <p className="text-sm text-[var(--on-surf-var)]">Órdenes asignadas</p>
        <p className="mt-1 text-4xl font-bold text-[var(--on-surf)]">
          {orders.length}
        </p>
      </section>
    </main>
  );
}
