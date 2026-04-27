import type { SessionUser } from "@/lib/auth-types";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Building2, Users, Wrench, CircleDollarSign, Package, AlertTriangle } from "lucide-react";

interface ConfigCard {
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  available: boolean;
}

const CARDS: ConfigCard[] = [
  {
    label: "Sucursal",
    description:
      "RFC, dirección, sello y términos legales por sucursal. Requerido para generar PDFs.",
    href: "/configuracion/sucursal",
    icon: Building2,
    roles: ["ADMIN"],
    available: true,
  },
  {
    label: "Usuarios",
    description:
      "Crear, editar y desactivar usuarios. Resetear contraseñas y reasignar sucursal.",
    href: "/configuracion/usuarios",
    icon: Users,
    roles: ["ADMIN"],
    available: true,
  },
  {
    label: "Servicios del taller",
    description:
      "Catálogo de mano de obra por sucursal. Usado al agregar conceptos a una orden de taller.",
    href: "/configuracion/servicios",
    icon: Wrench,
    roles: ["ADMIN", "MANAGER"],
    available: true,
  },
  {
    label: "Reglas de comisión",
    description: "Porcentajes y montos fijos por rol, modelo y sucursal.",
    href: "/configuracion/comisiones",
    icon: CircleDollarSign,
    roles: ["ADMIN", "MANAGER"],
    available: true,
  },
  {
    label: "Catálogo de productos",
    description:
      "Modelos, variantes y SimpleProduct (accesorios, cargadores, refacciones, baterías). MANAGER puede ver alertas de stock.",
    href: "/configuracion/catalogo",
    icon: Package,
    roles: ["ADMIN", "MANAGER"],
    available: true,
  },
  {
    label: "Umbrales",
    description:
      "Configura alertas cuando un KPI cruce un valor mínimo o máximo. Los reportes muestran un badge inline cuando se cruza el umbral.",
    href: "/configuracion/umbrales",
    icon: AlertTriangle,
    roles: ["ADMIN", "MANAGER"],
    available: true,
  },
];

export default async function ConfiguracionIndexPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/");

  const visible = CARDS.filter((c) => c.roles.includes(user.role));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Configuración
        </h1>
        <p className="text-sm text-[var(--on-surf-var)] mt-1">
          Módulos de administración. Disponibles según tu rol.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.map((card) => {
          const Icon = card.icon;
          const inner = (
            <div
              className="h-full p-5 rounded-2xl flex gap-4 transition-colors"
              style={{
                background: "var(--surf-lowest)",
                boxShadow: "var(--shadow)",
                opacity: card.available ? 1 : 0.5,
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "var(--r-lg)",
                  background: "var(--p-container)",
                  color: "var(--on-p-container)",
                }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2
                    className="text-base font-semibold text-[var(--on-surf)]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {card.label}
                  </h2>
                  {!card.available && (
                    <span
                      className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--surf-high)",
                        color: "var(--on-surf-var)",
                      }}
                    >
                      Próximamente
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--on-surf-var)] mt-1">
                  {card.description}
                </p>
              </div>
            </div>
          );
          if (!card.available) {
            return (
              <div key={card.label} className="cursor-not-allowed">
                {inner}
              </div>
            );
          }
          return (
            <Link key={card.label} href={card.href} className="block">
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
