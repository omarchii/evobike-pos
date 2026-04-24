import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBranchMaintenanceServices, getBikeMaintenanceStatus } from "@/lib/workshop-maintenance";
import { RecepcionWizard } from "./recepcion-wizard";
import type { MaintenanceServiceOption, TechnicianOption } from "@/lib/workshop-types";
import { getViewBranchId } from "@/lib/branch-filter";
import type { SessionUser } from "@/lib/auth-types";

export const dynamic = "force-dynamic";

interface ServiceOption {
  id: string;
  name: string;
  basePrice: number;
  chargeModel: string;
}

interface SearchParams {
  customerBikeId?: string;
  customerId?: string;
}

export default async function RecepcionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as unknown as SessionUser;
  const role = user.role;

  if (role === "SELLER") redirect("/workshop");
  // Recepción requiere sucursal concreta (crea una orden con branchId).
  // Admin en Global no tiene sucursal: redirigimos al tablero para que pique
  // una en el switcher. Deuda: admin debería tener picker en el form (principio
  // "writes nunca infieren del filtro") — hoy toma la cookie como proxy.
  const branchId = await getViewBranchId();
  if (!branchId) redirect("/workshop");

  const params = await searchParams;
  const prefillBikeId = params.customerBikeId;
  // customerBikeId GANA si ambos vienen (preserva flujo C.2 existente).
  const prefillCustomerId =
    !prefillBikeId && params.customerId ? params.customerId : null;

  const [maintenanceServices, allServices, technicians] = await Promise.all([
    getBranchMaintenanceServices(branchId),
    prisma.serviceCatalog.findMany({
      where: { branchId, isActive: true },
      select: { id: true, name: true, basePrice: true, chargeModel: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        branchId,
        role: { in: ["TECHNICIAN", "MANAGER"] },
        isActive: true,
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const technicianOptions: TechnicianOption[] = technicians.map((t) => ({
    id: t.id,
    name: t.name,
    role: t.role as "TECHNICIAN" | "MANAGER",
  }));

  const allServiceOptions: ServiceOption[] = allServices.map((s) => ({
    id: s.id,
    name: s.name,
    basePrice: Number(s.basePrice),
    chargeModel: s.chargeModel,
  }));

  // Prefill from ?customerBikeId query param
  let prefillBike: {
    id: string;
    brand: string | null;
    model: string | null;
    serialNumber: string;
    color: string | null;
  } | null = null;
  let prefillCustomer: {
    id: string;
    name: string;
    phone: string | null;
    bikes: { id: string; brand: string | null; model: string | null; serialNumber: string; color: string | null }[];
  } | null = null;
  let prefillMaintenanceStatus: {
    nivel: string;
    diasRestantes: number;
  } | null = null;

  if (prefillBikeId) {
    const bikeData = await prisma.customerBike.findUnique({
      where: { id: prefillBikeId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            bikes: {
              where: { branchId },
              select: { id: true, brand: true, model: true, serialNumber: true, color: true },
            },
          },
        },
      },
    });

    if (bikeData) {
      prefillBike = {
        id: bikeData.id,
        brand: bikeData.brand,
        model: bikeData.model,
        serialNumber: bikeData.serialNumber,
        color: bikeData.color,
      };
      if (bikeData.customer) {
        prefillCustomer = bikeData.customer;
      }
      const status = await getBikeMaintenanceStatus(prefillBikeId);
      if (status) {
        prefillMaintenanceStatus = {
          nivel: status.nivel,
          diasRestantes: status.diasRestantes,
        };
      }
    }
  } else if (prefillCustomerId) {
    // Prefill from ?customerId (D.3b). Solo cliente — bici se elige en Step1.
    const customerData = await prisma.customer.findUnique({
      where: { id: prefillCustomerId },
      select: {
        id: true,
        name: true,
        phone: true,
        bikes: {
          where: { branchId },
          select: {
            id: true,
            brand: true,
            model: true,
            serialNumber: true,
            color: true,
          },
        },
      },
    });
    if (customerData) {
      prefillCustomer = customerData;
    }
  }

  return (
    <div>
      <h1
        className="text-2xl font-bold mb-6"
        style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
      >
        Recepción de orden
      </h1>
      <RecepcionWizard
        technicians={technicianOptions}
        maintenanceServices={maintenanceServices as MaintenanceServiceOption[]}
        allServices={allServiceOptions}
        userRole={role}
        prefillBike={prefillBike}
        prefillCustomer={prefillCustomer}
        prefillMaintenanceStatus={prefillMaintenanceStatus}
      />
    </div>
  );
}
