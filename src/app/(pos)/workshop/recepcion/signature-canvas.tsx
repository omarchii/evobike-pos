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
}

const SignatureCanvas = forwardRef<SignatureCanvasHandle, SignatureCanvasProps>(
  ({ onChange, disabled = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);

    // Wrap onChange to satisfy react-hooks/use-memo inline-function requirement
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stableOnChange = useCallback((val: string | null) => onChange(val), []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const resizeCanvas = () => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d")?.scale(ratio, ratio);
        padRef.current?.clear();
      };

      padRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgba(0, 0, 0, 0)",
        penColor: "var(--on-surf, #131b2e)",
      });

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);

      const handleEndStroke = () => {
        if (padRef.current && !padRef.current.isEmpty()) {
          stableOnChange(padRef.current.toDataURL());
        }
      };
      padRef.current.addEventListener("endStroke", handleEndStroke);

      return () => {
        window.removeEventListener("resize", resizeCanvas);
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
