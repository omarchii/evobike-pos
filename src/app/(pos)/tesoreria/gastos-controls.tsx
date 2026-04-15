"use client";

import { useState } from "react";
import { FiltersBar } from "./filters-bar";
import { NuevoGastoDialog } from "./nuevo-gasto-dialog";

interface BranchOption {
    id: string;
    name: string;
}

interface Props {
    isAdmin: boolean;
    branches: BranchOption[];
    defaultBranchId: string;
    currentFrom: string;
    currentTo: string;
    currentCategoria: string;
    currentBranchId: string;
    currentSoloSinComprobante: boolean;
}

export function GastosControls({
    isAdmin,
    branches,
    defaultBranchId,
    currentFrom,
    currentTo,
    currentCategoria,
    currentBranchId,
    currentSoloSinComprobante,
}: Props): React.ReactElement {
    const [openNuevo, setOpenNuevo] = useState(false);

    return (
        <>
            <FiltersBar
                isAdmin={isAdmin}
                branches={branches}
                currentFrom={currentFrom}
                currentTo={currentTo}
                currentCategoria={currentCategoria}
                currentBranchId={currentBranchId}
                currentSoloSinComprobante={currentSoloSinComprobante}
                onNewExpense={() => setOpenNuevo(true)}
            />
            <NuevoGastoDialog
                open={openNuevo}
                onOpenChange={setOpenNuevo}
                isAdmin={isAdmin}
                branches={branches}
                defaultBranchId={defaultBranchId}
            />
        </>
    );
}
