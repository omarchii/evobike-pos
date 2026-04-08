---
name: Modal input surface tokens — recurring contrast bug
description: Using wrong --surf-high/--surf-highest tokens on form inputs in modals causes invisible or low-contrast fields. Documents the correct pattern from customer-selector-modal.tsx.
type: feedback
---

## Rule: Never use `--surf-high` or `--surf-highest` as the background of interactive form fields inside modals.

**Why:** This bug has occurred 3+ times. The root cause is:
- In **light mode**: `--surf-high` = `#dcf0e8` (pale green). The placeholder uses `text-muted-foreground` (medium gray), causing low contrast on the green background.
- In **dark mode**: `--surf-bright` = `--surf-high` = `#2b2b2b` — **identical values**. An input using `--surf-high` on a `--surf-bright` modal is completely invisible.

## How to apply: Correct field styling for any modal/dialog

**Copy this exact pattern from `customer-selector-modal.tsx`:**

```tsx
// Constants defined at the top of the modal file:
const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",   // ← KEY: surf-low, NOT surf-high or surf-lowest
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontWeight: 400,
  fontSize: "0.875rem",
  height: 44,
};

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  cursor: "pointer",
  width: "100%",
  paddingLeft: "0.75rem",
  paddingRight: "0.75rem",
  appearance: "none",
};
```

**Why `--surf-low` works in both modes:**
- Light: `--surf-low` = `#f0f7f4` (near-white, slight green tint) on modal (`#fafffe`) → subtle but visible
- Dark: `--surf-low` = `#1b1b1b` on modal (`--surf-bright` = `#2b2b2b`) → clearly recessed, good contrast

**Modal container must use glassmorphism (NOT solid background):**
```tsx
<DialogContent
  className="p-0 gap-0 overflow-hidden"
  style={{
    background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "var(--shadow)",
    borderRadius: "var(--r-xl)",
  }}
>
```

**CollapsibleSection pattern:**
- Header button: `background: "var(--surf-high)"` ← surf-high is correct for section headers (not inputs)
- Content grid: `background: "var(--surf-highest)"` ← deepest level within the section
- Inputs inside collapsible: still use `INPUT_STYLE` with `--surf-low` → appear lifted relative to `--surf-highest`

## Token cheat sheet for modals

| Element                        | Token              | Light     | Dark      |
|--------------------------------|--------------------|-----------|-----------|
| Modal background               | glassmorphism      | ~#fafffe  | ~#2b2b2b  |
| Input / select / textarea bg   | `--surf-low`       | #f0f7f4   | #1b1b1b   |
| Section container (group bg)   | `--surf-high`      | #dcf0e8   | #2b2b2b   |
| Collapsible content grid bg    | `--surf-highest`   | #c7e6d8   | #333333   |
| Hover on list items            | `--surf-high`      | #dcf0e8   | #2b2b2b   |
| List items (resting)           | `--surf-lowest`    | #ffffff   | #222222   |

## Reference implementation
See `src/app/(pos)/point-of-sale/customer-selector-modal.tsx` — the canonical correct implementation of this pattern.
