"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import { switchAdminBranch } from "@/lib/actions/branch";

interface Branch {
  id: string;
  code: string;
  name: string;
}

interface BranchSwitcherProps {
  activeBranchId: string;
  activeBranchName: string;
}

export function BranchSwitcher({ activeBranchId, activeBranchName }: BranchSwitcherProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/configuracion/sucursales")
      .then((r) => r.json())
      .then((res) => { if (res.success) setBranches(res.data); });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(branch: Branch) {
    if (branch.id === activeBranchId) { setOpen(false); return; }
    setOpen(false);
    startTransition(async () => {
      await switchAdminBranch(branch.id, branch.name);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium uppercase tracking-widest whitespace-nowrap text-white transition-opacity disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}
      >
        <span>BRANCH: {activeBranchName ?? "—"}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && branches.length > 0 && (
        <div className="absolute left-0 top-full mt-2 min-w-[180px] rounded-xl overflow-hidden shadow-lg border border-[var(--ghost-border)] bg-[var(--surf-lowest)] z-50">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => select(b)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-[var(--on-surf)] hover:bg-[var(--surf-high)] transition-colors"
            >
              <span>{b.name}</span>
              {b.id === activeBranchId && <Check className="h-3.5 w-3.5 text-[var(--primary-bright)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
