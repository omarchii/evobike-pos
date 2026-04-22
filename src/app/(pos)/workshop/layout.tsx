"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Kanban", href: "/workshop" },
  { label: "Recepción", href: "/workshop/recepcion" },
  { label: "Mantenimientos", href: "/workshop/mantenimientos" },
] as const;

export default function WorkshopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <nav
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: "var(--surf-low)" }}
      >
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/workshop"
              ? pathname === "/workshop"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? "var(--surf-highest)" : "transparent",
                color: isActive ? "var(--p)" : "var(--on-surf-var)",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
