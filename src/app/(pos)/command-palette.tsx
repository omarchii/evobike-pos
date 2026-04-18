"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import {
    LayoutDashboard,
    ShoppingCart,
    Wrench,
    Package,
    Users,
    Settings,
    BookmarkCheck,
    Vault,
    Bike,
    FileText,
    BarChart2,
    ShieldCheck,
    Landmark,
    ArrowLeftRight,
    Plus,
    Search,
    LogOut,
    type LucideIcon,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type {
    SearchCategory,
    SearchResponse,
    SearchResult,
} from "@/app/api/search/route";

// ─────────────────────────────────────────────────────────────────────────────
// Canal global de apertura
// ─────────────────────────────────────────────────────────────────────────────

export const COMMAND_PALETTE_OPEN_EVENT = "command-palette:open";

// ─────────────────────────────────────────────────────────────────────────────
// Navegación y acciones fijas (default state)
// ─────────────────────────────────────────────────────────────────────────────

type Role = "SELLER" | "TECHNICIAN" | "MANAGER" | "ADMIN";

interface StaticItem {
    label: string;
    href: string;
    icon: LucideIcon;
    roles?: Role[];
}

const NAV_ITEMS: StaticItem[] = [
    { label: "Ir a Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Ir a Punto de Venta", href: "/point-of-sale", icon: ShoppingCart },
    { label: "Ir a Pedidos", href: "/pedidos", icon: BookmarkCheck },
    { label: "Ir a Taller", href: "/workshop", icon: Wrench },
    { label: "Ir a Montaje", href: "/assembly", icon: Bike },
    { label: "Ir a Clientes", href: "/customers", icon: Users },
    { label: "Ir a Inventario", href: "/inventario", icon: Package },
    { label: "Ir a Cotizaciones", href: "/cotizaciones", icon: FileText },
    {
        label: "Ir a Transferencias",
        href: "/transferencias",
        icon: ArrowLeftRight,
        roles: ["SELLER", "MANAGER", "ADMIN"],
    },
    { label: "Ir a Reportes", href: "/reportes", icon: BarChart2 },
    { label: "Ir a Caja", href: "/cash-register", icon: Vault },
    {
        label: "Ir a Tesorería",
        href: "/tesoreria",
        icon: Landmark,
        roles: ["MANAGER", "ADMIN"],
    },
    {
        label: "Ir a Autorizaciones",
        href: "/autorizaciones",
        icon: ShieldCheck,
        roles: ["MANAGER", "ADMIN"],
    },
    {
        label: "Ir a Configuración",
        href: "/configuracion",
        icon: Settings,
        roles: ["ADMIN", "MANAGER"],
    },
];

// Acciones = navegaciones a formularios existentes. Las rutas "nuevo X" que no
// existen (cliente nuevo, orden de taller nueva) viven detrás de diálogos en
// las vistas de listado, así que llevamos al listado donde el botón "Nuevo"
// queda visible.
const ACTION_ITEMS: StaticItem[] = [
    { label: "Nueva venta", href: "/point-of-sale", icon: Plus },
    { label: "Nueva cotización", href: "/cotizaciones/nueva", icon: Plus },
    {
        label: "Nueva recepción de inventario",
        href: "/inventario/recepciones/nuevo",
        icon: Plus,
        roles: ["MANAGER", "ADMIN"],
    },
    { label: "Ir a cerrar caja", href: "/cash-register", icon: LogOut },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de "ver más" por categoría
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_LIST_HREF: Record<SearchCategory, string> = {
    customer: "/customers",
    "service-order": "/workshop",
    sale: "/ventas",
    product: "/configuracion/catalogo",
    quotation: "/cotizaciones",
    receipt: "/inventario/recepciones",
    expense: "/tesoreria",
    authorization: "/autorizaciones",
};

const SUBSCRIBE_NOOP = (): (() => void) => () => {};
const GET_IS_MAC = (): boolean =>
    typeof navigator !== "undefined" && navigator.platform.includes("Mac");
const GET_IS_MAC_SERVER = (): boolean => false;

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

interface CommandPaletteProps {
    role: Role;
}

export function CommandPalette({ role }: CommandPaletteProps): React.JSX.Element {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const isMac = useSyncExternalStore(SUBSCRIBE_NOOP, GET_IS_MAC, GET_IS_MAC_SERVER);

    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Atajo global + listener de evento para trigger externo.
    useEffect(() => {
        const handleKey = (e: KeyboardEvent): void => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        };
        const handleOpen = (): void => {
            setOpen(true);
        };
        window.addEventListener("keydown", handleKey);
        window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpen);
        return () => {
            window.removeEventListener("keydown", handleKey);
            window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpen);
        };
    }, []);

    // Reset al cerrar: abortamos cualquier fetch y limpiamos timers. El
    // state interno (query/results/etc) se resetea en el onOpenChange handler
    // para evitar setState síncrono dentro del effect.
    useEffect(() => {
        if (!open) {
            abortRef.current?.abort();
            if (debounceRef.current) clearTimeout(debounceRef.current);
        }
    }, [open]);

    // Debounce + fetch. El setState sucede dentro del setTimeout callback
    // (handler asíncrono), no en el cuerpo del effect.
    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            abortRef.current?.abort();
            if (debounceRef.current) clearTimeout(debounceRef.current);
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);
        abortRef.current?.abort();

        debounceRef.current = setTimeout(() => {
            const ctrl = new AbortController();
            abortRef.current = ctrl;
            setLoading(true);
            setError(false);
            fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
                signal: ctrl.signal,
                credentials: "same-origin",
            })
                .then(async (res) => {
                    if (!res.ok) throw new Error(`status ${res.status}`);
                    const payload = (await res.json()) as SearchResponse;
                    setResults(payload);
                    setLoading(false);
                })
                .catch((err: unknown) => {
                    if (err instanceof DOMException && err.name === "AbortError") return;
                    setError(true);
                    setLoading(false);
                });
        }, 200);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    const go = (href: string): void => {
        router.push(href);
        setOpen(false);
    };

    const navItems = NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
    const actionItems = ACTION_ITEMS.filter((i) => !i.roles || i.roles.includes(role));

    const showDefault = query.trim().length < 2;
    const hasResults = results !== null && results.total > 0;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    setQuery("");
                    setResults(null);
                    setError(false);
                    setLoading(false);
                }
                setOpen(next);
            }}
        >
            <DialogContent
                showCloseButton={false}
                className={cn(
                    "p-0 overflow-hidden border-0 sm:max-w-[640px] z-[100] top-[20%] translate-y-0",
                    "shadow-[var(--shadow-lg)]",
                )}
                style={{
                    background:
                        "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    border: "1px solid var(--ghost-border)",
                }}
            >
                <DialogHeader className="sr-only">
                    <DialogTitle>Paleta de comandos</DialogTitle>
                    <DialogDescription>
                        Busca clientes, órdenes, productos y más, o navega a otra sección.
                    </DialogDescription>
                </DialogHeader>
                <CommandPrimitive
                    shouldFilter={false}
                    label="Paleta de comandos"
                    className="flex flex-col"
                >
                    <CommandInput
                        value={query}
                        onValueChange={setQuery}
                        placeholder="Buscar clientes, órdenes, productos…"
                    />
                    <CommandList className="max-h-[420px]">
                        {showDefault ? (
                            <DefaultState
                                navItems={navItems}
                                actionItems={actionItems}
                                isMac={isMac}
                                onSelect={go}
                            />
                        ) : loading && !results ? (
                            <div className="px-3 py-6 space-y-2">
                                <div className="h-8 rounded-md bg-[var(--surf-high)] animate-pulse" />
                                <div className="h-8 rounded-md bg-[var(--surf-high)] animate-pulse" />
                            </div>
                        ) : error ? (
                            <div className="px-3 py-6 text-sm text-[var(--on-surf-var)] text-center">
                                No pudimos buscar. Intenta de nuevo.
                            </div>
                        ) : hasResults ? (
                            <ResultsState
                                results={results}
                                onSelect={go}
                            />
                        ) : (
                            <CommandEmpty>
                                <span className="text-[var(--on-surf-var)]">
                                    Sin resultados para &ldquo;{query}&rdquo;
                                </span>
                            </CommandEmpty>
                        )}
                    </CommandList>
                </CommandPrimitive>
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Default state — Navegación + Acciones
// ─────────────────────────────────────────────────────────────────────────────

function DefaultState({
    navItems,
    actionItems,
    isMac,
    onSelect,
}: {
    navItems: StaticItem[];
    actionItems: StaticItem[];
    isMac: boolean;
    onSelect: (href: string) => void;
}): React.JSX.Element {
    void isMac;
    return (
        <>
            <CommandGroup heading="Acciones">
                {actionItems.map((item) => (
                    <CommandItem
                        key={`action:${item.href}:${item.label}`}
                        value={`action:${item.href}:${item.label}`}
                        onSelect={() => onSelect(item.href)}
                    >
                        <item.icon className="h-4 w-4 text-[var(--p)]" />
                        <span>{item.label}</span>
                    </CommandItem>
                ))}
            </CommandGroup>
            <CommandGroup heading="Navegación">
                {navItems.map((item) => (
                    <CommandItem
                        key={`nav:${item.href}`}
                        value={`nav:${item.href}`}
                        onSelect={() => onSelect(item.href)}
                    >
                        <item.icon className="h-4 w-4 text-[var(--on-surf-var)]" />
                        <span>{item.label}</span>
                    </CommandItem>
                ))}
            </CommandGroup>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Results state
// ─────────────────────────────────────────────────────────────────────────────

function ResultsState({
    results,
    onSelect,
}: {
    results: SearchResponse;
    onSelect: (href: string) => void;
}): React.JSX.Element {
    return (
        <>
            {results.groups.map((group) => (
                <CommandGroup
                    key={group.category}
                    heading={`${group.label} (${group.count})`}
                >
                    {group.results.map((r: SearchResult) => (
                        <CommandItem
                            key={`${group.category}:${r.id}`}
                            value={`${group.category}:${r.id}`}
                            onSelect={() => onSelect(r.href)}
                        >
                            <div className="flex flex-col min-w-0">
                                <span className="truncate font-medium text-[var(--on-surf)]">
                                    {r.title}
                                </span>
                                {r.subtitle && (
                                    <span className="truncate text-xs text-[var(--on-surf-var)]">
                                        {r.subtitle}
                                    </span>
                                )}
                            </div>
                        </CommandItem>
                    ))}
                    {group.hasMore && (
                        <CommandItem
                            key={`${group.category}:see-more`}
                            value={`${group.category}:see-more`}
                            onSelect={() => onSelect(CATEGORY_LIST_HREF[group.category])}
                            className="text-[var(--p)]"
                        >
                            <Search className="h-4 w-4" />
                            <span>
                                Ver {group.count - group.results.length} más en {group.label}
                            </span>
                        </CommandItem>
                    )}
                </CommandGroup>
            ))}
        </>
    );
}
