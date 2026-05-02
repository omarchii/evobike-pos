"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type CSSProperties,
} from "react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

interface SupplierOption {
  id: string;
  nombre: string;
  rfc: string | null;
}

interface SupplierComboboxProps {
  /** Display text shown in the input (controlled). */
  displayValue: string;
  /** Called on every keystroke and on supplier selection. */
  onChangeText: (text: string) => void;
  /** Called with supplier id on selection, null when user edits free-text. */
  onSelect: (supplierId: string | null) => void;
  placeholder?: string;
  inputStyle?: CSSProperties;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

const ITEM_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  fontSize: "0.8125rem",
  color: "var(--on-surf)",
  textAlign: "left",
};

const RFC_STYLE: CSSProperties = {
  fontSize: "0.6875rem",
  color: "var(--on-surf-var)",
  fontFamily: "var(--font-body)",
  marginLeft: "0.75rem",
  flexShrink: 0,
};

const EMPTY_STYLE: CSSProperties = {
  padding: "0.75rem",
  fontSize: "0.75rem",
  color: "var(--on-surf-var)",
  fontFamily: "var(--font-body)",
  textAlign: "center",
};

export function SupplierCombobox({
  displayValue,
  onChangeText,
  onSelect,
  placeholder = "Buscar proveedor…",
  inputStyle,
  disabled,
  required,
  id,
}: SupplierComboboxProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressSearchRef = useRef(false);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setOptions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/suppliers?q=${encodeURIComponent(q)}`,
      );
      if (res.ok) {
        const json = (await res.json()) as {
          success: boolean;
          data?: SupplierOption[];
        };
        const data = json.data ?? [];
        setOptions(data);
        setOpen(data.length > 0);
      } else {
        setOptions([]);
        setOpen(false);
      }
    } catch {
      setOptions([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      onChangeText(text);
      onSelect(null);
      setHighlightIdx(-1);

      if (suppressSearchRef.current) {
        suppressSearchRef.current = false;
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(text), 250);
    },
    [onChangeText, onSelect, search],
  );

  const handleSelectOption = useCallback(
    (opt: SupplierOption) => {
      suppressSearchRef.current = true;
      onChangeText(opt.nombre);
      onSelect(opt.id);
      setOpen(false);
      setHighlightIdx(-1);
    },
    [onChangeText, onSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || options.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, options.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && highlightIdx >= 0) {
        e.preventDefault();
        handleSelectOption(options[highlightIdx]);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [open, options, highlightIdx, handleSelectOption],
  );

  const handleFocus = useCallback(() => {
    if (displayValue.length >= 2 && options.length === 0) {
      search(displayValue);
    } else if (options.length > 0) {
      setOpen(true);
    }
  }, [displayValue, options.length, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <input
          id={id}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          style={inputStyle}
          disabled={disabled}
          required={required}
          autoComplete="off"
        />
      </PopoverAnchor>
      <PopoverContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="p-0"
        style={{
          border: "none",
          background: "var(--surf-lowest)",
          borderRadius: "var(--r-lg)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
          maxHeight: 220,
          overflowY: "auto",
          width: "var(--radix-popover-trigger-width)",
        }}
        align="start"
        sideOffset={4}
      >
        {loading && <p style={EMPTY_STYLE}>Buscando…</p>}
        {!loading && options.length === 0 && (
          <p style={EMPTY_STYLE}>Sin resultados</p>
        )}
        {options.map((opt, idx) => (
          <button
            key={opt.id}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelectOption(opt);
            }}
            style={{
              ...ITEM_STYLE,
              background:
                idx === highlightIdx ? "var(--surf-high)" : "transparent",
            }}
          >
            <span>{opt.nombre}</span>
            {opt.rfc && <span style={RFC_STYLE}>{opt.rfc}</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
