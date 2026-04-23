"use client";

// Kebab del header del perfil de cliente (BRIEF §7.4 — Sub-fase J).
// Acciones: Editar · Descargar ficha PDF · Fusionar · Eliminar
// (Fusionar/Eliminar requieren MANAGER+).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/primitives/icon";
import { DeleteCustomerDialog } from "./delete-customer-dialog";

interface Props {
  customerId: string;
  customerName: string;
  isManagerPlus: boolean;
}

export function HeaderActionsMenu({
  customerId,
  customerName,
  isManagerPlus,
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center h-8 w-8 rounded-full"
        style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
        title="Más acciones"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="more" size={14} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 z-30 p-1.5 flex flex-col"
          style={{
            background: "color-mix(in srgb, var(--surf-bright) 92%, transparent)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: "var(--r-md)",
            boxShadow: "0px 12px 32px -4px rgba(19,27,46,0.18)",
          }}
        >
          <MenuLink
            href={`/customers/${customerId}/editar`}
            label="Editar datos"
            icon="more"
            onClick={() => setOpen(false)}
          />
          <MenuLink
            href={`/api/customers/${customerId}/ficha/pdf`}
            label="Descargar ficha PDF"
            icon="download"
            external
            onClick={() => setOpen(false)}
          />
          {isManagerPlus && (
            <>
              <MenuDivider />
              <MenuLink
                href={`/customers/${customerId}/merge`}
                label="Fusionar con…"
                icon="share"
                onClick={() => setOpen(false)}
              />
              <DeleteCustomerDialog
                customerId={customerId}
                customerName={customerName}
                onClose={() => setOpen(false)}
                trigger={
                  <button
                    type="button"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-left rounded-[var(--r-sm)]"
                    style={{ color: "var(--ter)", background: "transparent" }}
                  >
                    <Icon name="alert" size={13} />
                    Eliminar cliente
                  </button>
                }
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  label,
  icon,
  external,
  onClick,
}: {
  href: string;
  label: string;
  icon: "more" | "download" | "share";
  external?: boolean;
  onClick?: () => void;
}): React.JSX.Element {
  const content = (
    <span className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-[var(--r-sm)] hover:bg-[var(--surf-high)]"
      style={{ color: "var(--on-surf)" }}
    >
      <Icon name={icon} size={13} />
      {label}
    </span>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
        onClick={onClick}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={href} role="menuitem" onClick={onClick}>
      {content}
    </Link>
  );
}

function MenuDivider(): React.JSX.Element {
  return (
    <div
      className="my-1 mx-1 h-px"
      style={{ background: "var(--surf-low)" }}
      aria-hidden
    />
  );
}
