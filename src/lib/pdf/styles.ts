import { StyleSheet } from "@react-pdf/renderer";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";

// Márgenes de página: 30pt arriba/abajo, 35pt laterales
const PAGE_MARGIN_V = 30;
const PAGE_MARGIN_H = 35;

export const styles = StyleSheet.create({
  // ── Página ──────────────────────────────────────────────────────────────────
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: colors.text,
    backgroundColor: colors.bgPage,
    paddingTop: PAGE_MARGIN_V,
    paddingBottom: PAGE_MARGIN_V + 20, // espacio extra para footer
    paddingHorizontal: PAGE_MARGIN_H,
  },

  // ── Layout helpers ────────────────────────────────────────────────────────
  section: {
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  col: {
    flex: 1,
  },

  // ── Cápsulas de label ─────────────────────────────────────────────────────
  labelChip: {
    backgroundColor: colors.bgLabelChip,
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginRight: 4,
    alignSelf: "flex-start",
  },
  valueText: {
    fontSize: 9,
    color: colors.text,
    alignSelf: "center",
  },

  // ── Tabla ─────────────────────────────────────────────────────────────────
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.text,
    backgroundColor: colors.bgTableHeader,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRight: `0.5pt solid ${colors.border}`,
  },
  tableBodyCell: {
    fontSize: 9,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRight: `0.5pt solid ${colors.border}`,
    borderBottom: `0.5pt solid ${colors.border}`,
  },
});
