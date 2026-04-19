"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabModelos } from "./tab-modelos";
import { TabVariantes } from "./tab-variantes";
import { TabBaterias } from "./tab-baterias";
import { TabBatteryConfigs } from "./tab-battery-configs";
import { TabSimpleProducts } from "./tab-simple-products";
import { TabAlertas } from "./tab-alertas";
import type {
  ModeloRow,
  ColorRow,
  VoltajeRow,
  CapacidadRow,
  VarianteRow,
  BatteryVariantRow,
  BatteryConfigRow,
  SimpleProductRow,
  BranchRow,
} from "./shared";

interface InitialData {
  modelos: ModeloRow[];
  colores: ColorRow[];
  voltajes: VoltajeRow[];
  capacidades: CapacidadRow[];
  variantes: VarianteRow[];
  batteryVariants: BatteryVariantRow[];
  batteryConfigs: BatteryConfigRow[];
  simpleProducts: SimpleProductRow[];
  branches: BranchRow[];
}

export function CatalogoClient({
  role,
  userBranchId,
  initialData,
}: {
  role: string;
  userBranchId: string | null;
  initialData: InitialData;
}) {
  const isAdmin = role === "ADMIN";
  const defaultTab = isAdmin ? "modelos" : "alertas";
  const [tab, setTab] = useState<string>(defaultTab);

  const [modelos, setModelos] = useState<ModeloRow[]>(initialData.modelos);
  const [colores] = useState<ColorRow[]>(initialData.colores);
  const [voltajes] = useState<VoltajeRow[]>(initialData.voltajes);
  const [capacidades] = useState<CapacidadRow[]>(initialData.capacidades);
  const [variantes, setVariantes] = useState<VarianteRow[]>(initialData.variantes);
  const [batteryVariants, setBatteryVariants] = useState<BatteryVariantRow[]>(
    initialData.batteryVariants,
  );
  const [batteryConfigs, setBatteryConfigs] = useState<BatteryConfigRow[]>(
    initialData.batteryConfigs,
  );
  const [simpleProducts, setSimpleProducts] = useState<SimpleProductRow[]>(
    initialData.simpleProducts,
  );

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full flex-wrap justify-start gap-1 h-auto p-1">
        {isAdmin && <TabsTrigger value="modelos">Modelos</TabsTrigger>}
        {isAdmin && <TabsTrigger value="variantes">Variantes</TabsTrigger>}
        {isAdmin && <TabsTrigger value="baterias">Baterías</TabsTrigger>}
        {isAdmin && <TabsTrigger value="battery-configs">Config. Baterías</TabsTrigger>}
        {isAdmin && <TabsTrigger value="simples">Productos Simples</TabsTrigger>}
        <TabsTrigger value="alertas">Alertas de Stock</TabsTrigger>
      </TabsList>

      {isAdmin && (
        <TabsContent value="modelos">
          <TabModelos
            modelos={modelos}
            colores={colores}
            onChange={setModelos}
          />
        </TabsContent>
      )}
      {isAdmin && (
        <TabsContent value="variantes">
          <TabVariantes
            variantes={variantes.filter((v) => !v.modelo_esBateria)}
            modelos={modelos.filter((m) => !m.esBateria)}
            colores={colores}
            voltajes={voltajes}
            onChange={(next) =>
              setVariantes([
                ...variantes.filter((v) => v.modelo_esBateria),
                ...next,
              ])
            }
          />
        </TabsContent>
      )}
      {isAdmin && (
        <TabsContent value="baterias">
          <TabBaterias
            variants={batteryVariants}
            voltajes={voltajes}
            capacidades={capacidades}
            onChange={setBatteryVariants}
          />
        </TabsContent>
      )}
      {isAdmin && (
        <TabsContent value="battery-configs">
          <TabBatteryConfigs
            configs={batteryConfigs}
            modelos={modelos}
            voltajes={voltajes}
            batteryVariants={batteryVariants}
            onChange={setBatteryConfigs}
          />
        </TabsContent>
      )}
      {isAdmin && (
        <TabsContent value="simples">
          <TabSimpleProducts
            items={simpleProducts}
            onChange={setSimpleProducts}
          />
        </TabsContent>
      )}
      <TabsContent value="alertas">
        <TabAlertas
          isAdmin={isAdmin}
          userBranchId={userBranchId}
          branches={initialData.branches}
        />
      </TabsContent>

      {/* Sub-editors for colores and voltajes live at the bottom of Modelos tab */}
    </Tabs>
  );
}
