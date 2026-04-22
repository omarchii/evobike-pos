"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import SignaturePad from "signature_pad";

export interface SignatureCanvasHandle {
  clear: () => void;
  isEmpty: () => boolean;
}

interface SignatureCanvasProps {
  onChange: (value: string | null) => void;
  disabled?: boolean;
  value?: string | null;
}

function readPenColor(): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--on-surf")
    .trim();
  return raw || "#131b2e";
}

const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  ({ onChange, disabled = false, value }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);
    // Snapshot used to repaint on resize / restore on mount. Not reactive to parent updates.
    const initialValueRef = useRef<string | null | undefined>(value);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stableOnChange = useCallback((val: string | null) => onChange(val), []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      padRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgba(0, 0, 0, 0)",
        penColor: readPenColor(),
      });

      const resizeCanvas = () => {
        const pad = padRef.current;
        if (!pad) return;
        const snapshot = pad.isEmpty()
          ? (initialValueRef.current ?? null)
          : pad.toDataURL();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d")?.scale(ratio, ratio);
        pad.clear();
        if (snapshot) pad.fromDataURL(snapshot);
      };

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      // next-themes toggles `.dark` on <html> — repaint penColor live so the
      // stroke remains visible without forcing a remount.
      const themeObserver = new MutationObserver(() => {
        if (padRef.current) padRef.current.penColor = readPenColor();
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });

      const handleEndStroke = () => {
        if (padRef.current && !padRef.current.isEmpty()) {
          stableOnChange(padRef.current.toDataURL());
        }
      };
      padRef.current.addEventListener("endStroke", handleEndStroke);

      return () => {
        window.removeEventListener("resize", resizeCanvas);
        themeObserver.disconnect();
        padRef.current?.off();
      };
    }, [stableOnChange]);

    useEffect(() => {
      if (!padRef.current) return;
      if (disabled) {
        padRef.current.off();
      } else {
        padRef.current.on();
      }
    }, [disabled]);

    useImperativeHandle(ref, () => ({
      clear() {
        padRef.current?.clear();
        initialValueRef.current = null;
        stableOnChange(null);
      },
      isEmpty() {
        return padRef.current?.isEmpty() ?? true;
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{
          height: 160,
          borderRadius: 8,
          background: "var(--surf-low)",
          cursor: disabled ? "not-allowed" : "crosshair",
          opacity: disabled ? 0.5 : 1,
          display: "block",
        }}
      />
    );
  },
);
SignatureCanvas.displayName = "SignatureCanvas";
export default SignatureCanvas;
