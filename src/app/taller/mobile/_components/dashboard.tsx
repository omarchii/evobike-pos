"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  initialsFromName,
  tabOfOrder,
  type MobileTab,
  type SerializedMobileOrder,
} from "@/lib/workshop-mobile";
import Header from "./header";
import KpiCard from "./kpi-card";
import OrderCard from "./order-card";
import ActionSheet from "./action-sheet";
import UnassignedSheet from "./unassigned-sheet";
import { usePollingRefresh } from "./use-polling-refresh";

interface DashboardProps {
  userId: string;
  userName: string;
  branchName: string;
  orders: SerializedMobileOrder[];
  // Timestamp estable desde el server para que los "hace X min" de las
  // cards no disparen hydration mismatch.
  nowMs: number;
}

const TAB_DEFS: { value: MobileTab; label: string; emptyHint: string }[] = [
  { value: "queue", label: "Mi cola", emptyHint: "Nada en tu cola." },
  { value: "waiting", label: "Esperando", emptyHint: "Ninguna orden en espera." },
  { value: "done", label: "Listas", emptyHint: "Sin órdenes completadas." },
];

export default function Dashboard({
  userId,
  userName,
  branchName,
  orders,
  nowMs,
}: DashboardProps) {
  const router = useRouter();
  const [tab, setTab] = useState<MobileTab>("queue");
  const [selectedOrder, setSelectedOrder] = useState<SerializedMobileOrder | null>(null);
  const [unassignedOpen, setUnassignedOpen] = useState(false);

  usePollingRefresh();

  const initials = useMemo(() => initialsFromName(userName), [userName]);

  const grouped = useMemo(() => {
    const g: Record<MobileTab, SerializedMobileOrder[]> = {
      queue: [],
      waiting: [],
      done: [],
    };
    for (const o of orders) g[tabOfOrder(o)].push(o);
    return g;
  }, [orders]);

  const { activeCount, pendingCount } = useMemo(() => {
    let active = 0;
    let pending = 0;
    for (const o of orders) {
      if (o.status === "IN_PROGRESS" && o.subStatus === null) active++;
      else if (o.status === "PENDING") pending++;
    }
    return { activeCount: active, pendingCount: pending };
  }, [orders]);

  const refresh = () => router.refresh();

  // Empty state cuando no hay nada asignado. El CTA abre el mismo sheet
  // de "Sin asignar" que usa el FAB — el técnico puede tomarse una
  // orden sin salir de la pantalla.
  if (orders.length === 0) {
    return (
      <>
        <div className="flex min-h-screen flex-col">
          <Header userName={userName} branchName={branchName} initials={initials} />
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <Wrench className="size-12 opacity-40" aria-hidden />
            <h2 className="text-lg font-semibold text-[var(--on-surf)]">
              No tienes órdenes asignadas
            </h2>
            <p className="max-w-xs text-sm text-[var(--on-surf-var)]">
              Toma una de las órdenes sin asignar del taller.
            </p>
            <button
              type="button"
              onClick={() => setUnassignedOpen(true)}
              className="mt-2 rounded-full px-5 py-2.5 text-sm font-medium transition-transform active:scale-95"
              style={{ background: "var(--p-container)", color: "var(--on-p-container)" }}
            >
              Ver sin asignar
            </button>
          </div>
        </div>
        <UnassignedSheet
          open={unassignedOpen}
          onOpenChange={setUnassignedOpen}
          branchName={branchName}
          currentUserId={userId}
          onMutated={refresh}
        />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen">
        <Header userName={userName} branchName={branchName} initials={initials} />
        <main className="mx-auto w-full max-w-md px-4 pb-10 pt-4">
          <KpiCard
            activeCount={activeCount}
            pendingCount={pendingCount}
            onFabClick={() => setUnassignedOpen(true)}
          />

          <Tabs value={tab} onValueChange={(v) => setTab(v as MobileTab)} className="gap-3">
            {/* Mock_2 exige scroll horizontal porque los 3 chips no caben
                cómodamente bajo 360px con badges. `-mx-4 px-4` extiende el
                overflow hasta el borde físico del device. */}
            <div className="-mx-4 overflow-x-auto px-4">
              <TabsList
                variant="line"
                className="h-auto w-max gap-1 bg-transparent p-0"
              >
                {TAB_DEFS.map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="h-10 gap-2 rounded-full border border-[var(--outline-var)]/30 bg-[var(--surf-lowest)] px-4 text-sm font-medium data-[state=active]:border-transparent data-[state=active]:bg-[var(--p-container)] data-[state=active]:text-[var(--on-p-container)]"
                  >
                    <span>{t.label}</span>
                    <span
                      className="inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold leading-none"
                      style={{
                        background:
                          tab === t.value
                            ? "color-mix(in oklab, var(--on-p-container) 14%, transparent)"
                            : "var(--surf-high)",
                      }}
                    >
                      {grouped[t.value].length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {TAB_DEFS.map((t) => {
              const list = grouped[t.value];
              return (
                <TabsContent key={t.value} value={t.value} className="space-y-3">
                  {list.length === 0 ? (
                    <p className="py-10 text-center text-sm text-[var(--on-surf-var)]">
                      {t.emptyHint}
                    </p>
                  ) : (
                    list.map((o) => (
                      <OrderCard
                        key={o.id}
                        order={o}
                        nowMs={nowMs}
                        onSelect={setSelectedOrder}
                      />
                    ))
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </main>
      </div>

      <ActionSheet
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onMutated={refresh}
      />
      <UnassignedSheet
        open={unassignedOpen}
        onOpenChange={setUnassignedOpen}
        branchName={branchName}
        currentUserId={userId}
        onMutated={refresh}
      />
    </>
  );
}
