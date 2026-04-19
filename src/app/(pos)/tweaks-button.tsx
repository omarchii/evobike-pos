"use client";

import * as React from "react";
import { Icon } from "@/components/primitives/icon";
import { TweaksPanel } from "@/components/shell/tweaks-panel";

export function TweaksButton() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[var(--on-surf-var)] hover:text-[var(--on-surf)] transition-colors"
        aria-label="Ajustes visuales"
        title="Ajustes visuales"
      >
        <Icon name="sliders" size={20} />
      </button>
      <TweaksPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
