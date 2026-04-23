import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth-types";

// El dashboard es 100% dependiente de la sesión + query en vivo. Cualquier
// cache de layout/page contaminaría lo que ve el técnico al cambiar de
// turno o tomar/soltar una orden.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Taller móvil · EvoBike",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/taller/mobile");
  }
  const user = session.user as unknown as SessionUser;
  if (user.role !== "TECHNICIAN") {
    redirect("/workshop");
  }

  // El mock del dashboard está diseñado en oscuro y la paleta de tokens
  // dark ya está lista (globals.css). Forzamos `.dark` en el subtree para
  // que el técnico vea siempre el mismo look en piso, independiente del
  // tema que haya dejado activo next-themes (la ruta no tiene toggle).
  return (
    <div className="dark min-h-screen bg-[var(--surface)] text-[var(--on-surf)]">
      {children}
    </div>
  );
}
